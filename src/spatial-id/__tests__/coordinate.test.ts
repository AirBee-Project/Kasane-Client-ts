import { describe, expect, it } from "vitest";
import { Coordinate } from "../coordinate.js";
import { GeometryError, SpatialIdError } from "../error.js";
import { RangeId } from "../rangeId.js";
import { SingleId } from "../singleId.js";

function expectError(fn: () => unknown, info: GeometryError["info"]) {
  try {
    fn();
    expect.unreachable();
  } catch (e) {
    expect(e).toBeInstanceOf(GeometryError);
    expect((e as GeometryError).info).toEqual(info);
  }
}

describe("Coordinate.create", () => {
  it("緯度・経度・高度を持つ", () => {
    const c = Coordinate.create(35.6812, 139.7671, 10);
    expect([c.latitude, c.longitude, c.altitude]).toEqual([
      35.6812, 139.7671, 10,
    ]);
  });

  it("範囲の端の値は作成できる", () => {
    expect(() => Coordinate.create(85.0511, 180, 2 ** 25)).not.toThrow();
    expect(() => Coordinate.create(-85.0511, -180, -(2 ** 25))).not.toThrow();
  });

  it("範囲外の緯度は LatitudeOutOfRange を投げる", () => {
    for (const latitude of [85.0512, -85.0512, Number.NaN]) {
      expectError(() => Coordinate.create(latitude, 0, 0), {
        kind: "LatitudeOutOfRange",
        latitude,
      });
    }
  });

  it("範囲外の経度は LongitudeOutOfRange を投げる", () => {
    for (const longitude of [180.0001, -181, Number.NaN]) {
      expectError(() => Coordinate.create(0, longitude, 0), {
        kind: "LongitudeOutOfRange",
        longitude,
      });
    }
  });

  it("範囲外の高度は AltitudeOutOfRange を投げる", () => {
    for (const altitude of [
      2 ** 25 + 1,
      -(2 ** 25) - 1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      expectError(() => Coordinate.create(0, 0, altitude), {
        kind: "AltitudeOutOfRange",
        altitude,
      });
    }
  });

  it("エラーメッセージは Kasane と同じ", () => {
    expect(() => Coordinate.create(86, 0, 0)).toThrow(
      "Latitude '86' is out of range",
    );
    expect(() => Coordinate.create(0, 181, 0)).toThrow(
      "Longitude '181' is out of range",
    );
    expect(() => Coordinate.create(0, 0, 4e7)).toThrow(
      "Altitude '40000000' is out of range",
    );
  });

  it("Kasane と同じく緯度・経度・高度の順に検証する", () => {
    expectError(() => Coordinate.create(86, 181, 4e7), {
      kind: "LatitudeOutOfRange",
      latitude: 86,
    });
    expectError(() => Coordinate.create(0, 181, 4e7), {
      kind: "LongitudeOutOfRange",
      longitude: 181,
    });
  });
});

describe("Coordinate.toSingleId", () => {
  it("東京駅の座標から空間IDを求める", () => {
    const id = Coordinate.create(35.6812, 139.7671, 10).toSingleId(20);
    expect(id.toString()).toBe("20/0/931389/412906");
  });

  it("Kasane のドキュメントと同じ結果になる", () => {
    // kasane-logic Coordinate::single_id の doctest
    const id = Coordinate.create(34.9851603, 135.7584294, 20).toSingleId(24);
    expect(id.toString()).toBe("24/10/14715409/6646263");
  });

  it("高度からfを求める（z=25 では 1 m ごと、負の高度も扱う）", () => {
    expect(Coordinate.create(0, 0, 3.7).toSingleId(25).f).toBe(3);
    expect(Coordinate.create(0, 0, -0.5).toSingleId(25).f).toBe(-1);
  });

  it("範囲の端は端のボクセルに含める", () => {
    const max = Coordinate.create(85.0511, 180, 2 ** 25).toSingleId(3);
    expect([max.x, max.y, max.f]).toEqual([7, 0, 7]);

    const min = Coordinate.create(-85.0511, -180, -(2 ** 25)).toSingleId(3);
    expect([min.x, min.y, min.f]).toEqual([0, 7, -8]);
  });

  it("不正なズームレベルは SpatialIdError を投げる", () => {
    expect(() => Coordinate.create(0, 0, 0).toSingleId(31)).toThrow(
      SpatialIdError,
    );
  });
});

describe("SingleId.toCenterCoordinate / toCoordinateRange（空間IDから座標へ）", () => {
  it("中心はボクセルの範囲の中にあり、元の空間IDに戻る", () => {
    const id = SingleId.parse("20/3/931389/412906");
    const c = id.toCenterCoordinate();
    const b = id.toCoordinateRange();
    expect(c).toBeInstanceOf(Coordinate);
    expect(c.latitude).toBeGreaterThan(b.latitude[0]);
    expect(c.latitude).toBeLessThan(b.latitude[1]);
    expect(c.longitude).toBeGreaterThan(b.longitude[0]);
    expect(c.longitude).toBeLessThan(b.longitude[1]);
    expect(c.altitude).toBeGreaterThan(b.altitude[0]);
    expect(c.altitude).toBeLessThan(b.altitude[1]);
    expect(c.altitude).toBe(112);
    expect(c.toSingleId(20).toString()).toBe(id.toString());
  });

  it("ズームレベル 0 の範囲は地球全体と高さ 2^25 m", () => {
    const b = SingleId.create(0, 0, 0, 0).toCoordinateRange();
    expect(b.latitude[0]).toBeCloseTo(-85.0511287798066, 10);
    expect(b.latitude[1]).toBeCloseTo(85.0511287798066, 10);
    expect(b.longitude).toEqual([-180, 180]);
    expect(b.altitude).toEqual([0, 2 ** 25]);
  });
});

describe("RangeId.toCenterCoordinate / toCoordinateRange（RangeId から座標へ）", () => {
  it("中心はインデックスの平均から求める", () => {
    const range = RangeId.create(20, [0, 2], [931388, 931390], 412906);
    const single = SingleId.create(20, 1, 931389, 412906);
    expect(range.toCenterCoordinate()).toEqual(single.toCenterCoordinate());
  });

  it("1 ボクセルの RangeId は SingleId と同じ範囲になる", () => {
    const single = SingleId.parse("20/3/931389/412906");
    expect(single.toRangeId().toCoordinateRange()).toEqual(
      single.toCoordinateRange(),
    );
  });

  it("両端のボクセルの外側を囲む", () => {
    const r = RangeId.parse(
      "20/0:7/931389:931394/412900:412901",
    ).toCoordinateRange();
    const nw = SingleId.parse("20/0/931389/412900").toCoordinateRange();
    const se = SingleId.parse("20/7/931394/412901").toCoordinateRange();
    expect(r.longitude).toEqual([nw.longitude[0], se.longitude[1]]);
    expect(r.latitude).toEqual([se.latitude[0], nw.latitude[1]]);
    expect(r.altitude).toEqual([0, 8 * 32]);
  });

  it("経度 180 度をまたぐ範囲は、西端の経度が東端より大きくなる", () => {
    const r = RangeId.create(3, 0, [6, 1], 2).toCoordinateRange();
    expect(r.longitude).toEqual([90, -90]);
  });
});
