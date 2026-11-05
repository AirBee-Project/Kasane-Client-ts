import { describe, expect, it } from "vitest";
import { SpatialIdError } from "../../spatial-id/error.js";
import { ZoomLevel } from "../../spatial-id/zoomLevel.js";
import { Coordinate } from "../coordinate.js";
import { Ecef } from "../ecef.js";
import { Epsilon } from "../epsilon.js";
import { GeometryError } from "../error.js";
import { FractionalId } from "../fractionalId.js";
import { Vec3 } from "../vec3.js";

const LAT_MAX = 85.0511;
const LON_MAX = 180;
const ALT_MAX = 2 ** 25;

function kindOf(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    if (e instanceof GeometryError || e instanceof SpatialIdError) {
      return e.info.kind;
    }
    throw e;
  }
  return "none";
}

describe("Epsilon", () => {
  it("0 以上の有限な値を受け付ける", () => {
    expect(Epsilon.fromMeters(0.01).asMeters()).toBe(0.01);
    expect(Epsilon.fromMeters(0).asMeters()).toBe(0);
  });

  it("既定値は 1µm", () => {
    expect(Epsilon.DEFAULT.asMeters()).toBe(1e-6);
    expect(Epsilon.ZERO.asMeters()).toBe(0);
  });

  it("負数・NaN・無限大は EpsilonOutOfRange を投げる", () => {
    for (const v of [
      -0.001,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      expect(kindOf(() => Epsilon.fromMeters(v))).toBe("EpsilonOutOfRange");
    }
  });
});

describe("Coordinate → Ecef", () => {
  // Kasane-Logic のスナップショットの値。三角関数の最終桁は実行環境で変わりうるので近似で比べる
  const cases: [Coordinate, [number, number, number]][] = [
    [
      Coordinate.create(43.068_564, 41.350_713_8, 30),
      [3503254.6369501497, 3083182.6924748584, 4333089.862951963],
    ],
    [
      Coordinate.create(35.681_382, 139.766_084, 10),
      [-3959603.80135368, 3350144.3678688137, 3699539.029081585],
    ],
    [
      Coordinate.create(LAT_MAX - Number.EPSILON, 45, 123),
      [390373.88168020203, 390373.881680202, 6333018.279102522],
    ],
  ];

  it("Rust と同じ ECEF になる", () => {
    for (const [c, [x, y, z]] of cases) {
      const e = c.toEcef();
      expect(e.x).toBeCloseTo(x, 6);
      expect(e.y).toBeCloseTo(y, 6);
      expect(e.z).toBeCloseTo(z, 6);
    }
  });

  it("ECEF から座標へ戻せる", () => {
    const ecef = Ecef.create(
      3_503_254.636_950_15,
      3_083_182.692_474_858,
      4_333_089.862_951_96,
    );
    const c = ecef.toCoordinate();
    expect(c.latitude).toBeCloseTo(43.06856399999993, 9);
    expect(c.longitude).toBeCloseTo(41.350713799999994, 9);
    expect(c.altitude).toBeCloseTo(29.999998352490366, 3);
  });

  it("高度の高い点も戻せる", () => {
    const c = Ecef.create(
      4_075_576.132_840_001,
      3_073_465.945_881,
      4_862_865.221_340_001,
    ).toCoordinate();
    expect(c.latitude).toBeCloseTo(43.78457120701716, 9);
    expect(c.longitude).toBeCloseTo(37.020609168845276, 9);
    expect(c.altitude).toBeCloseTo(682164.8995031277, 3);
  });
});

describe("範囲の端での往復", () => {
  const latitudes = [LAT_MAX, -LAT_MAX, 0, 35, -60];
  const altitudes = [ALT_MAX, 0, -10_000, 1_000_000];

  function* boundaryCoordinates() {
    for (const lat of latitudes) {
      for (const alt of altitudes) {
        for (let lon = -180; lon <= 180; lon += 15) {
          yield Coordinate.create(lat, lon, alt);
        }
      }
    }
  }

  it("ECEF の成分から作り直せる", () => {
    for (const c of boundaryCoordinates()) {
      const e = c.toEcef();
      expect(() => Ecef.create(e.x, e.y, e.z), c.toString()).not.toThrow();
    }
  });

  it("座標へ戻すと範囲に収まる", () => {
    for (const c of boundaryCoordinates()) {
      const back = c.toEcef().toCoordinate();
      expect(
        () => Coordinate.create(back.latitude, back.longitude, back.altitude),
        `${c} -> ${back}`,
      ).not.toThrow();
    }
  });

  it("許容幅を大きく超える点は拒む", () => {
    const e = Coordinate.create(35, 135, ALT_MAX).toEcef();
    expect(() => Ecef.create(e.x * 1.001, e.y * 1.001, e.z * 1.001)).toThrow(
      GeometryError,
    );
  });
});

describe("Ecef.create", () => {
  it("地表付近の点を受け付ける", () => {
    for (const [lat, lon] of [
      [0, 0],
      [35, 135],
      [-60, -120],
      [85, 10],
      [-85, 170],
    ] as const) {
      const e = Coordinate.createUnchecked(lat, lon, 0).toEcef();
      expect(() => Ecef.create(e.x, e.y, e.z)).not.toThrow();
    }
  });

  it("縮退した点や有限でない値を拒む", () => {
    expect(() => Ecef.create(0, 0, 0)).toThrow(GeometryError);
    expect(() => Ecef.create(0, 0, 6_356_752)).toThrow(GeometryError);
    expect(() => Ecef.create(Number.NaN, 0, 0)).toThrow(GeometryError);
    expect(() => Ecef.create(Number.POSITIVE_INFINITY, 0, 0)).toThrow(
      GeometryError,
    );
    expect(() => Ecef.create(0, Number.NEGATIVE_INFINITY, 0)).toThrow(
      GeometryError,
    );
    expect(() => Ecef.create(0, 0, Number.POSITIVE_INFINITY)).toThrow(
      GeometryError,
    );
  });

  it("早期判定と厳密な判定が一致する", () => {
    // 決定的な疑似乱数（xorshift32）。範囲の内外にまたがる点で、簡易判定と厳密判定を比べる
    let state = 0xec3f;
    const next = () => {
      state ^= state << 13;
      state >>>= 0;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      return state / 0xffffffff;
    };
    const range = (lo: number, hi: number) => lo + (hi - lo) * next();

    const exact = (x: number, y: number, z: number): boolean => {
      try {
        Coordinate.fromVec3(new Vec3(x, y, z));
        return true;
      } catch {
        return false;
      }
    };
    const accepts = (x: number, y: number, z: number): boolean => {
      try {
        Ecef.create(x, y, z);
        return true;
      } catch {
        return false;
      }
    };

    for (let i = 0; i < 5_000; i++) {
      const [x, y, z] = [
        range(-4.5e7, 4.5e7),
        range(-4.5e7, 4.5e7),
        range(-4.5e7, 4.5e7),
      ];
      expect(accepts(x, y, z), `${x}, ${y}, ${z}`).toBe(exact(x, y, z));

      const e = Coordinate.createUnchecked(
        range(-87, 87),
        range(-LON_MAX, LON_MAX),
        range(-7.0e6, 3.4e7),
      ).toEcef();
      expect(accepts(e.x, e.y, e.z), e.toString()).toBe(exact(e.x, e.y, e.z));
    }
  });
});

describe("Coordinate → SingleId", () => {
  it("既知の値と一致する", () => {
    const id = Coordinate.create(34.9851603, 135.7584294, 20).singleId(24);
    expect(id.toString()).toBe("24/10/14715409/6646263");
  });

  it("範囲外のズームレベルは ZOutOfRange を投げる", () => {
    const c = Coordinate.create(35, 139, 10);
    expect(kindOf(() => c.singleId(31))).toBe("ZOutOfRange");
    expect(kindOf(() => c.rangeId(31))).toBe("ZOutOfRange");
    expect(kindOf(() => c.fractionalId(31))).toBe("ZOutOfRange");
  });

  it("上端の値は最後のインデックスに丸める", () => {
    for (const z of [0, 5, 25, 30]) {
      const zoom = ZoomLevel.create(z);

      const top = Coordinate.create(0, LON_MAX, ALT_MAX).singleId(z);
      expect(top.x, `z=${z}`).toBe(zoom.xyMax());
      expect(top.f, `z=${z}`).toBe(zoom.fMax());

      const bottom = Coordinate.create(0, -LON_MAX, -ALT_MAX).singleId(z);
      expect(bottom.x, `z=${z}`).toBe(0);
      expect(bottom.f, `z=${z}`).toBe(zoom.fMin());
    }
  });

  it("緯度の上限でも有効な ID になる", () => {
    for (const z of [0, 5, 25, 30]) {
      for (const lat of [LAT_MAX, -LAT_MAX]) {
        const id = Coordinate.create(lat, 0, 0).singleId(z);
        expect(id.y).toBeGreaterThanOrEqual(0);
        expect(id.y).toBeLessThanOrEqual(ZoomLevel.create(z).xyMax());
      }
    }
  });

  it("rangeId は singleId と同じ範囲を表す", () => {
    const c = Coordinate.create(35.681382, 139.766084, 10.3);
    for (const z of [0, 10, 20, 25]) {
      expect(c.rangeId(z).equals(c.singleId(z).toRangeId()), `z=${z}`).toBe(
        true,
      );
    }
  });

  it("coverSingleIds は点を含む 1 件だけを返す", () => {
    const c = Coordinate.create(35.681382, 139.766084, 10.3);
    expect(c.coverSingleIds(20)).toHaveLength(1);
    expect(c.coverSingleIds(20)[0]?.equals(c.singleId(20))).toBe(true);
  });
});

describe("FractionalId", () => {
  it("Coordinate から小数のインデックスを求める", () => {
    const f = Coordinate.create(34.9851603, 135.7584294, 20).fractionalId(24);
    expect(f.f).toBe(10);
    expect(f.x).toBeCloseTo(14715409.371845974, 6);
    expect(f.y).toBeCloseTo(6646263.059889234, 6);
  });

  it("小数部分を保つ", () => {
    const c = Coordinate.create(0, 90, 10.5);
    expect(c.fractionalId(1).x).toBe(1.5);
    expect(c.fractionalId(25).f).toBe(10.5);
  });

  it("上端の面に届く", () => {
    for (const z of [0, 5, 25, 30]) {
      const zoom = ZoomLevel.create(z);
      const f = Coordinate.create(0, LON_MAX, ALT_MAX).fractionalId(z);
      expect(f.x, `z=${z}`).toBe(zoom.xyMax() + 1);
      expect(f.f, `z=${z}`).toBe(zoom.fMax() + 1);
    }
  });

  it("singleId は fractionalId を丸めたものと一致する", () => {
    const coords = [
      Coordinate.create(34.9851603, 135.7584294, 20),
      Coordinate.create(35.681382, 139.766084, 10.3),
      Coordinate.create(0, 0, 0),
      Coordinate.create(-12.5, 90, -1234.5),
      Coordinate.create(LAT_MAX, -LON_MAX, ALT_MAX),
      Coordinate.create(-LAT_MAX, LON_MAX, -ALT_MAX),
    ];
    for (const c of coords) {
      for (const z of [0, 1, 5, 20, 25, 30]) {
        expect(
          c.singleId(z).equals(c.fractionalId(z).roundToSingleId()),
          `${c}, z=${z}`,
        ).toBe(true);
      }
    }
  });

  it("切り捨てて SingleId にする", () => {
    const id = FractionalId.create(4, 5.5, 6.2, 7.8).roundToSingleId();
    expect(id.toString()).toBe("4/5/6/7");
  });

  it("範囲外は FractionalXOutOfRange などを投げる", () => {
    expect(kindOf(() => FractionalId.create(4, 17, 0, 0))).toBe(
      "FractionalFOutOfRange",
    );
    expect(kindOf(() => FractionalId.create(4, 0, -0.1, 0))).toBe(
      "FractionalXOutOfRange",
    );
    expect(kindOf(() => FractionalId.create(4, 0, 0, Number.NaN))).toBe(
      "FractionalYOutOfRange",
    );
    expect(kindOf(() => FractionalId.create(31, 0, 0, 0))).toBe("ZOutOfRange");
  });

  it("上端ちょうどの値は最後のインデックスに丸める", () => {
    for (const z of [0, 4, 25, 30]) {
      const zoom = ZoomLevel.create(z);
      const top = FractionalId.create(
        z,
        zoom.fMax() + 1,
        zoom.xyMax() + 1,
        zoom.xyMax() + 1,
      ).roundToSingleId();
      expect([top.f, top.x, top.y], `z=${z}`).toEqual([
        zoom.fMax(),
        zoom.xyMax(),
        zoom.xyMax(),
      ]);

      const bottom = FractionalId.create(
        z,
        zoom.fMin(),
        0,
        0,
      ).roundToSingleId();
      expect([bottom.f, bottom.x, bottom.y], `z=${z}`).toEqual([
        zoom.fMin(),
        0,
        0,
      ]);
    }
  });

  it("intoAnotherZoomlevel は各インデックスを 2 の冪倍する", () => {
    const f = FractionalId.create(4, 5.5, 6.25, 7.75);

    const deeper = f.intoAnotherZoomlevel(6);
    expect([deeper.z, deeper.f, deeper.x, deeper.y]).toEqual([6, 22, 25, 31]);

    const shallower = f.intoAnotherZoomlevel(2);
    expect([shallower.z, shallower.f, shallower.x, shallower.y]).toEqual([
      2, 1.375, 1.5625, 1.9375,
    ]);

    for (const z of [0, 2, 4, 10, 30]) {
      const back = f.intoAnotherZoomlevel(z).intoAnotherZoomlevel(4);
      expect([back.f, back.x, back.y], `z=${z}`).toEqual([5.5, 6.25, 7.75]);
    }
    expect(kindOf(() => f.intoAnotherZoomlevel(31))).toBe("ZOutOfRange");
  });

  it("別のズームレベルの SingleId を求められる", () => {
    const f = FractionalId.create(4, 5.5, 6.2, 7.8);
    expect(f.singleId(6).toString()).toBe("6/22/24/31");
    const g = FractionalId.create(6, 22, 24.8, 31.2);
    expect(g.singleId(4).toString()).toBe("4/5/6/7");
  });

  it("Ecef を経由して Coordinate に戻せる", () => {
    const f = FractionalId.create(4, 5.5, 6.2, 7.8);
    const c = f.toCoordinate();
    const back = f.toEcef().toCoordinate();
    expect(Math.abs(back.latitude - c.latitude)).toBeLessThan(1e-9);
    expect(Math.abs(back.longitude - c.longitude)).toBeLessThan(1e-9);
    expect(Math.abs(back.altitude - c.altitude)).toBeLessThan(1e-3);
  });
});

describe("Coordinate.centroid", () => {
  it("緯度の上限の座標の重心でも範囲に収まる", () => {
    const coords = Array.from({ length: 34 }, (_, i) =>
      Coordinate.create(LAT_MAX, -170 + 10 * i, 0),
    );
    expect(Coordinate.centroid(coords).latitude).toBe(LAT_MAX);
  });

  it("日付変更線をまたぐ重心は 180 度付近になる", () => {
    const a = Coordinate.create(0, 179.999, 0);
    const b = Coordinate.create(0, -179.999, 0);
    expect(Math.abs(Coordinate.centroid([a, b]).longitude)).toBeGreaterThan(
      179.99,
    );
  });

  it("空なら原点", () => {
    expect(Coordinate.centroid([]).toString()).toBe("0, 0, 0");
  });
});

describe("Point の共通操作", () => {
  it("同じ点は許容誤差 0 でも等しい", () => {
    const a = Coordinate.create(35, 139, 10);
    expect(a.eqEpsilon(a, Epsilon.ZERO)).toBe(true);
    expect(a.eqEpsilon(a, Epsilon.DEFAULT)).toBe(true);
  });

  it("許容誤差より離れた点は等しくない", () => {
    const p1 = Coordinate.create(35, 139, 0);
    const p2 = Coordinate.create(35, 139, 0.0001);
    expect(p1.eqEpsilon(p2, Epsilon.fromMeters(0.001))).toBe(true);
    expect(p1.eqEpsilon(p2, Epsilon.fromMeters(0.00001))).toBe(false);
  });

  it("distance は ECEF 上の距離を返す", () => {
    const a = Coordinate.create(0, 0, 0);
    const b = Coordinate.create(0, 0, 100);
    expect(a.distance(b)).toBeCloseTo(100, 6);
  });

  it("with* は 1 つだけ差し替え、範囲外なら投げる", () => {
    const c = Coordinate.create(35, 139, 10);
    expect(c.withLatitude(36).toString()).toBe("36, 139, 10");
    expect(c.withLongitude(140).toString()).toBe("35, 140, 10");
    expect(c.withAltitude(11).toString()).toBe("35, 139, 11");
    expect(kindOf(() => c.withLatitude(90))).toBe("LatitudeOutOfRange");
    expect(kindOf(() => c.withLongitude(181))).toBe("LongitudeOutOfRange");
    expect(kindOf(() => c.withAltitude(ALT_MAX + 1))).toBe(
      "AltitudeOutOfRange",
    );
  });
});
