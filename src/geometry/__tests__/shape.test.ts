import { describe, expect, it } from "vitest";
import { Coordinate } from "../coordinate.js";
import { Epsilon } from "../epsilon.js";
import { GeometryError } from "../error.js";
import { Cylinder } from "../shape/cylinder.js";
import { Line } from "../shape/line.js";
import { Polygon } from "../shape/polygon.js";
import { Solid } from "../shape/solid.js";
import { Sphere } from "../shape/sphere.js";
import { Triangle } from "../shape/triangle.js";
import { Tube } from "../shape/tube.js";
import { rustSnapshots } from "./rustSnapshots.js";

/** 大きな正解データを件数とハッシュで比べるための 53 ビットのハッシュ（cyrb53）。 */
function cyrb53(text: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

function sorted(ids: readonly { toString(): string }[]): string[] {
  return ids.map((id) => id.toString()).sort();
}

function expectMatchesRust(
  name: string,
  ids: readonly { toString(): string }[],
) {
  const actual = sorted(ids);
  const snapshot = rustSnapshots[name];
  if (snapshot === undefined) {
    throw new Error(`missing snapshot: ${name}`);
  }
  if (Array.isArray(snapshot)) {
    expect(actual).toEqual(snapshot);
  } else {
    expect(actual.length).toBe(snapshot.count);
    expect(cyrb53(actual.join("\n"))).toBe(snapshot.hash);
  }
}

function coord(lat: number, lon: number, alt: number) {
  return Coordinate.create(lat, lon, alt);
}

describe("Line.coverSingleIds", () => {
  it("水平な線分", () => {
    const line = Line.create([
      coord(35.681, 139.766, 0),
      coord(35.682, 139.767, 0),
    ]);
    expectMatchesRust("line/flat_segment_at_z25", line.coverSingleIds(25));
  });

  it("垂直な線分", () => {
    const line = Line.create([
      coord(35.681, 139.766, 0),
      coord(35.681, 139.766, 100),
    ]);
    expectMatchesRust("line/vertical_segment_at_z25", line.coverSingleIds(25));
  });

  it("斜めの線分", () => {
    const line = Line.create([
      coord(35.68, 139.765, 0),
      coord(35.683, 139.768, 60),
    ]);
    expectMatchesRust("line/diagonal_segment_at_z25", line.coverSingleIds(25));
  });

  it("折れ線は個々の線分の和と同じ", () => {
    const p0 = coord(35.68, 139.765, 0);
    const p1 = coord(35.682, 139.766, 0);
    const p2 = coord(35.683, 139.768, 0);
    const polyline = new Set(
      Line.coverPolyline([p0, p1, p2], 20).map((id) => id.toString()),
    );
    const expectedIds = new Set([
      ...Line.create([p0, p1])
        .coverSingleIds(20)
        .map((id) => id.toString()),
      ...Line.create([p1, p2])
        .coverSingleIds(20)
        .map((id) => id.toString()),
    ]);
    expect(polyline).toEqual(expectedIds);
  });
});

describe("Triangle.coverSingleIds", () => {
  it("水平な三角形", () => {
    const tri = Triangle.create([
      coord(35.681, 139.766, 10),
      coord(35.682, 139.766, 10),
      coord(35.681, 139.767, 10),
    ]);
    expectMatchesRust(
      "triangle/horizontal_triangle_at_z25",
      tri.coverSingleIds(25),
    );
  });

  it("高度方向に傾いた三角形", () => {
    const tri = Triangle.create([
      coord(35.681, 139.766, 0),
      coord(35.682, 139.766, 0),
      coord(35.681, 139.766, 64),
    ]);
    expectMatchesRust(
      "triangle/tilted_triangle_at_z25",
      tri.coverSingleIds(25),
    );
  });

  it("緯度・経度・高度がすべて異なる三角形", () => {
    const tri = Triangle.create([
      coord(35.681, 139.766, 0),
      coord(35.683, 139.767, 0),
      coord(35.682, 139.766, 64),
    ]);
    expectMatchesRust(
      "triangle/three_dimensional_triangle_at_z25",
      tri.coverSingleIds(25),
    );
  });

  it("1 つのボクセルに収まる三角形も、そのボクセルを返す", () => {
    const p0 = coord(35.681, 139.766, 10);
    const tri = Triangle.create([
      p0,
      coord(35.681001, 139.766, 10),
      coord(35.681, 139.766001, 10),
    ]);
    const ids = sorted(tri.coverSingleIds(16));
    expect(ids).toContain(p0.singleId(16).toString());
  });

  it("面積を求められる", () => {
    const tri = Triangle.create([
      coord(35, 139, 0),
      coord(35.001, 139, 0),
      coord(35, 139.001, 0),
    ]);
    // 約 111m × 91m の直角三角形
    expect(tri.area()).toBeGreaterThan(4_500);
    expect(tri.area()).toBeLessThan(5_500);
  });

  it("expandLines は 3 辺を返す", () => {
    const p0 = coord(35, 139, 10);
    const p1 = coord(35.0002, 139, 10);
    const p2 = coord(35, 139.0002, 10);
    const lines = Triangle.create([p0, p1, p2]).expandLines();
    expect(lines.map((l) => l.points)).toEqual([
      [p0, p1],
      [p1, p2],
      [p2, p0],
    ]);
  });
});

describe("Polygon", () => {
  it("四角形", () => {
    const polygon = Polygon.create([
      coord(35.681, 139.766, 10),
      coord(35.684, 139.766, 10),
      coord(35.684, 139.769, 10),
      coord(35.681, 139.769, 10),
    ]);
    expectMatchesRust(
      "polygon/horizontal_quadrilateral_at_z18",
      polygon.coverSingleIds(18),
    );
  });

  it("三角形", () => {
    const polygon = Polygon.create([
      coord(35.681, 139.766, 10),
      coord(35.684, 139.766, 10),
      coord(35.682, 139.769, 10),
    ]);
    expectMatchesRust(
      "polygon/horizontal_triangle_polygon_at_z18",
      polygon.coverSingleIds(18),
    );
  });

  it("五角形", () => {
    const polygon = Polygon.create([
      coord(35.682, 139.767, 10),
      coord(35.683, 139.766, 10),
      coord(35.684, 139.767, 10),
      coord(35.684, 139.769, 10),
      coord(35.681, 139.769, 10),
    ]);
    expectMatchesRust("polygon/pentagon_at_z18", polygon.coverSingleIds(18));
  });

  it("許容誤差内で連続する頂点を同一視し、縮退した多角形は空になる", () => {
    const p0 = coord(35.0, 139.0, 0);
    const p1 = coord(35.0, 139.001, 0);
    const p2 = coord(35.001, 139.0, 0);
    const pClose = coord(35.001000001, 139.0, 0);

    const loose = Polygon.create([p0, p1, p2, pClose], Epsilon.fromMeters(1));
    expect(loose.vertices).toHaveLength(3);

    const strict = Polygon.create([p0, p1, p2, pClose], Epsilon.ZERO);
    expect(strict.vertices).toHaveLength(4);

    expect(Polygon.create([p0, p1]).vertices).toHaveLength(0);
    expect(Polygon.create([p0, p0, p0]).vertices).toHaveLength(0);
  });

  it("始点と終点が一致していれば終点を取り除く", () => {
    const p0 = coord(35.0, 139.0, 0);
    const p1 = coord(35.0, 139.001, 0);
    const p2 = coord(35.001, 139.0, 0);
    expect(Polygon.create([p0, p1, p2, p0]).vertices).toEqual([p0, p1, p2]);
  });

  it("四角形は 2 つの三角形に分割される", () => {
    const polygon = Polygon.create([
      coord(35.681, 139.766, 10),
      coord(35.684, 139.766, 10),
      coord(35.684, 139.769, 10),
      coord(35.681, 139.769, 10),
    ]);
    expect(polygon.expandTriangles()).toHaveLength(2);
    expect(polygon.expandLines()).toHaveLength(6);
  });
});

describe("Sphere", () => {
  it("半径 30m・z20", () => {
    const sphere = Sphere.create(coord(35.681, 139.766, 10), 30);
    expectMatchesRust(
      "sphere/small_sphere_radius_30m_at_z20",
      sphere.coverSingleIds(20),
    );
  });

  it("半径 100m・z18", () => {
    const sphere = Sphere.create(coord(35.681, 139.766, 50), 100);
    expectMatchesRust(
      "sphere/medium_sphere_radius_100m_at_z18",
      sphere.coverSingleIds(18),
    );
  });

  it("高度 0 の球", () => {
    const sphere = Sphere.create(coord(35.681, 139.766, 0), 30);
    expectMatchesRust(
      "sphere/sphere_at_ground_level_at_z20",
      sphere.coverSingleIds(20),
    );
  });

  it("半径が正でなければ RadiusNegative を投げる", () => {
    for (const radius of [0, -1, Number.NaN]) {
      expect(() => Sphere.create(coord(35, 139, 0), radius)).toThrow(
        GeometryError,
      );
    }
  });
});

describe("Cylinder", () => {
  it("水平な円柱", () => {
    const cylinder = Cylinder.create(
      coord(35.681, 139.766, 10),
      coord(35.682, 139.767, 10),
      5,
    );
    expectMatchesRust(
      "cylinder/horizontal_cylinder_at_z18",
      cylinder.coverSingleIds(18),
    );
  });

  it("斜めの円柱", () => {
    const cylinder = Cylinder.create(
      coord(35.681, 139.766, 0),
      coord(35.682, 139.767, 32),
      5,
    );
    expectMatchesRust(
      "cylinder/diagonal_cylinder_at_z18",
      cylinder.coverSingleIds(18),
    );
  });

  it("coverRangeIds は coverSingleIds と同じ範囲を表す", () => {
    const cylinder = Cylinder.create(
      coord(35.681, 139.766, 0),
      coord(35.682, 139.767, 32),
      5,
    );
    const fromRanges = new Set<string>();
    for (const range of cylinder.coverRangeIds(18)) {
      for (const id of range.singleIds()) {
        fromRanges.add(id.toString());
      }
    }
    expect(fromRanges).toEqual(
      new Set(cylinder.coverSingleIds(18).map((id) => id.toString())),
    );
  });

  it("半径が正でなければ RadiusNegative を投げる", () => {
    expect(() =>
      Cylinder.create(coord(35, 139, 0), coord(35, 139, 10), 0),
    ).toThrow(GeometryError);
  });

  it("roughSurfacesWithZ は半径が大きいほど細かく分割する", () => {
    const small = Cylinder.create(coord(35, 139, 0), coord(35, 139, 10), 1);
    const large = Cylinder.create(coord(35, 139, 0), coord(35, 139, 10), 500);
    expect(small.roughSurfacesWithZ(25)).toHaveLength(57 + 2);
    expect(large.roughSurfacesWithZ(25).length).toBeGreaterThan(57 + 2);
  });
});

describe("Tube", () => {
  it("2 区間の折れ線", () => {
    const tube = Tube.create(
      [
        coord(35.681, 139.766, 10),
        coord(35.682, 139.767, 10),
        coord(35.683, 139.766, 10),
      ],
      5,
    );
    expectMatchesRust(
      "tube/bent_two_segment_tube_at_z18",
      tube.coverSingleIds(18),
    );
  });

  it("3 区間の折れ線", () => {
    const tube = Tube.create(
      [
        coord(35.681, 139.766, 10),
        coord(35.682, 139.767, 10),
        coord(35.683, 139.767, 10),
        coord(35.683, 139.766, 10),
      ],
      5,
    );
    expectMatchesRust(
      "tube/three_segment_tube_at_z18",
      tube.coverSingleIds(18),
    );
  });

  it("高度方向に曲がる折れ線", () => {
    const tube = Tube.create(
      [
        coord(35.681, 139.766, 0),
        coord(35.682, 139.766, 0),
        coord(35.682, 139.766, 32),
      ],
      5,
    );
    expectMatchesRust(
      "tube/vertically_bent_tube_at_z18",
      tube.coverSingleIds(18),
    );
  });

  it("頂点がなければ空を返す", () => {
    expect(Tube.create([], 5).coverSingleIds(18)).toEqual([]);
  });
});

function tetrahedron(
  p0: Coordinate,
  p1: Coordinate,
  p2: Coordinate,
  p3: Coordinate,
) {
  return Solid.create([
    Polygon.create([p0, p2, p1]),
    Polygon.create([p0, p1, p3]),
    Polygon.create([p1, p2, p3]),
    Polygon.create([p2, p0, p3]),
  ]);
}

describe("Solid", () => {
  it("四面体は頂点のボクセルを含む", () => {
    const p0 = coord(35.0, 139.0, 10);
    const p1 = coord(35.001, 139.0, 10);
    const p2 = coord(35.0, 139.001, 10);
    const p3 = coord(35.0, 139.0, 110);
    const ids = sorted(tetrahedron(p0, p1, p2, p3).coverSingleIds(16));
    for (const p of [p0, p1, p2, p3]) {
      expect(ids).toContain(p.singleId(16).toString());
    }
  });

  it("coverRangeIds は coverSingleIds と同じ範囲を表す", () => {
    const solid = tetrahedron(
      coord(35.0, 139.0, 0),
      coord(35.001, 139.0, 0),
      coord(35.0, 139.001, 0),
      coord(35.0, 139.0, 500),
    );
    const fromRanges = new Set<string>();
    for (const range of solid.coverRangeIds(22)) {
      for (const id of range.singleIds()) {
        fromRanges.add(id.toString());
      }
    }
    const fromSingles = new Set(
      solid.coverSingleIds(22).map((id) => id.toString()),
    );
    expect(fromRanges).toEqual(fromSingles);
    expect(fromSingles.size).toBeGreaterThan(0);
  });

  it("閉じた立方体は内部まで覆う", () => {
    // 低ズームでは各辺が数ボクセルになる、一辺約 1.2km の立方体
    const lat0 = 35.0;
    const lat1 = 35.01;
    const lon0 = 139.0;
    const lon1 = 139.0125;
    const lo = 0;
    const hi = 1_200;
    const p = (la: number, lo2: number, a: number) => coord(la, lo2, a);
    const solid = Solid.create([
      Polygon.create([
        p(lat0, lon0, lo),
        p(lat1, lon0, lo),
        p(lat1, lon1, lo),
        p(lat0, lon1, lo),
      ]),
      Polygon.create([
        p(lat0, lon0, hi),
        p(lat0, lon1, hi),
        p(lat1, lon1, hi),
        p(lat1, lon0, hi),
      ]),
      Polygon.create([
        p(lat0, lon0, lo),
        p(lat0, lon1, lo),
        p(lat0, lon1, hi),
        p(lat0, lon0, hi),
      ]),
      Polygon.create([
        p(lat1, lon0, lo),
        p(lat1, lon0, hi),
        p(lat1, lon1, hi),
        p(lat1, lon1, lo),
      ]),
      Polygon.create([
        p(lat0, lon0, lo),
        p(lat0, lon0, hi),
        p(lat1, lon0, hi),
        p(lat1, lon0, lo),
      ]),
      Polygon.create([
        p(lat0, lon1, lo),
        p(lat1, lon1, lo),
        p(lat1, lon1, hi),
        p(lat0, lon1, hi),
      ]),
    ]);
    const z = 18;
    const ids = solid.coverSingleIds(z);
    const center = coord(35.005, 139.00625, 600).singleId(z);
    expect(sorted(ids)).toContain(center.toString());
  });

  it("閉じていなければ SolidNotWatertight を投げる", () => {
    const p0 = coord(35.0, 139.0, 0);
    const p1 = coord(35.001, 139.0, 0);
    const p2 = coord(35.0, 139.001, 0);
    const p3 = coord(35.0, 139.0, 500);
    try {
      Solid.create([
        Polygon.create([p0, p2, p1]),
        Polygon.create([p0, p1, p3]),
        Polygon.create([p1, p2, p3]),
      ]);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(GeometryError);
      expect((e as GeometryError).info.kind).toBe("SolidNotWatertight");
    }
    expect(() => Solid.create([])).toThrow(GeometryError);
  });

  it("許容誤差を指定しても閉じていれば作成できる", () => {
    const p0 = coord(35.0, 139.0, 0);
    const p1 = coord(35.001, 139.0, 0);
    const p2 = coord(35.0, 139.001, 0);
    const p3 = coord(35.0, 139.0, 500);
    expect(() =>
      Solid.create(
        [
          Polygon.create([p0, p2, p1]),
          Polygon.create([p0, p1, p3]),
          Polygon.create([p1, p2, p3]),
          Polygon.create([p2, p0, p3]),
        ],
        Epsilon.fromMeters(0.001),
      ),
    ).not.toThrow();
  });
});
