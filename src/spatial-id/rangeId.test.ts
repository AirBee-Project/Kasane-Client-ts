import { describe, expect, it } from "vitest";
import { SpatialIdError } from "./error";
import { FlexId } from "./flexId";
import { RangeId } from "./rangeId";

describe("RangeId.create（生成と検証）", () => {
  it("各軸に単一の値を渡すと[v, v]に退化した範囲になる", () => {
    const range = RangeId.create(4, -3, 8, 5);
    expect(range.f).toEqual([-3, -3]);
    expect(range.x).toEqual([8, 8]);
    expect(range.y).toEqual([5, 5]);
  });

  it("f, yは昇順に並び替えるが、周期境界を持つxはそのまま", () => {
    const range = RangeId.create(4, [6, -3], [9, 8], [10, 5]);
    expect(range.f).toEqual([-3, 6]);
    expect(range.x).toEqual([9, 8]);
    expect(range.y).toEqual([5, 10]);
  });

  it("いずれかの軸が範囲外ならエラーを投げる", () => {
    expect(() => RangeId.create(4, [-3, 29], [8, 9], [5, 10])).toThrow(
      SpatialIdError,
    );
  });

  it("ズームレベルが範囲外ならエラーを投げる", () => {
    expect(() => RangeId.create(68, [-3, 29], [8, 9], [5, 10])).toThrow(
      SpatialIdError,
    );
  });
});

describe("RangeId.createUnchecked（検証なしの生成）", () => {
  it("検証も並び替えも行わずに値をそのまま保持する", () => {
    const range = RangeId.createUnchecked(4, [6, -3], [9, 8], [10, 5]);
    expect(range.f).toEqual([6, -3]);
    expect(range.x).toEqual([9, 8]);
    expect(range.y).toEqual([10, 5]);
  });

  it("単一の値を渡すと[v, v]に退化した範囲になる", () => {
    const range = RangeId.createUnchecked(4, -3, 8, 5);
    expect(range.f).toEqual([-3, -3]);
    expect(range.x).toEqual([8, 8]);
    expect(range.y).toEqual([5, 5]);
  });
});

describe("RangeId.withTime（時間区間の設定）", () => {
  it("単一値または[min, max]ペアを受け取り、昇順に並び替える", () => {
    const range = RangeId.create(4, [-3, 6], [8, 9], [5, 10]).withTime(
      3600,
      [8, 5],
    );
    expect(range.interval.seconds()).toBe(3600);
    expect(range.t).toEqual([5, 8]);
  });
});

describe("RangeId.toSingleIds（SingleIdへの展開）", () => {
  it("直方体を全ての点へ展開する", () => {
    const range = RangeId.create(4, [0, 1], [0, 1], [0, 1]);
    const singles = [...range.toSingleIds()];
    expect(singles).toHaveLength(8);
    expect(singles.every((s) => s.z === 4)).toBe(true);
  });

  it("周期境界をまたぐx範囲(x[0] > x[1])を正しく展開する", () => {
    const range = RangeId.create(3, 0, [6, 1], 0); // 6, 7, 0, 1と折り返す
    const xs = [...range.toSingleIds()].map((s) => s.x);
    expect(xs).toEqual([6, 7, 0, 1]);
  });

  it("時間の範囲にも展開する", () => {
    const range = RangeId.create(4, 0, 0, 0).withTime(3600, [0, 2]);
    const ts = [...range.toSingleIds()].map((s) => s.t);
    expect(ts).toEqual([0, 1, 2]);
  });
});

describe("RangeId（FlexIdイテレータとしての展開）", () => {
  it("任意の空間範囲を、同じ点をちょうど覆うFlexId群へ分解する", () => {
    const z = 4;
    const range = RangeId.create(z, [-3, 6], [8, 9], [5, 10]);
    const flexes = [...range];
    expect(flexes.length).toBeGreaterThan(0);
    expect(flexes.every((f) => f instanceof FlexId)).toBe(true);

    const widenAxis = (axisZoom: number, index: number): [number, number] => {
      const scale = 2 ** (z - axisZoom);
      const start = index * scale;
      return [start, start + scale - 1];
    };

    const covered = new Set<string>();
    for (const f of flexes) {
      const [fLo, fHi] = widenAxis(f.fZoomLevel, f.fIndex);
      const [xLo, xHi] = widenAxis(f.xZoomLevel, f.xIndex);
      const [yLo, yHi] = widenAxis(f.yZoomLevel, f.yIndex);
      for (let fv = fLo; fv <= fHi; fv++) {
        for (let xv = xLo; xv <= xHi; xv++) {
          for (let yv = yLo; yv <= yHi; yv++) {
            covered.add(`${fv},${xv},${yv}`);
          }
        }
      }
    }

    const direct = [...range.toSingleIds()].map((s) => `${s.f},${s.x},${s.y}`);
    expect(covered.size).toBe(direct.length);
    for (const key of direct) {
      expect(covered.has(key)).toBe(true);
    }
  });

  it("2の冪でない時間範囲を、ちょうど覆うSegment群へ分解する", () => {
    const range = RangeId.create(4, 0, 1, 1).withTime(1800, [1, 3]); // [1800, 7200)
    const flexes = [...range];

    const seconds = new Set<number>();
    for (const f of flexes) {
      const width = 2 ** (35 - f.tZoomLevel);
      const start = f.tIndex * width;
      for (let s = start; s < start + width; s++) seconds.add(s);
    }
    expect(seconds.size).toBe(7200 - 1800);
    expect(Math.min(...seconds)).toBe(1800);
    expect(Math.max(...seconds)).toBe(7199);
  });
});

describe("SingleId・RangeId・FlexId の相互変換", () => {
  it("FlexId.toRangeIdは各軸を共通の最大ズームへ拡大する", () => {
    const flex = FlexId.create(5, 3, 2, 3, 10, 1);
    const range = flex.toRangeId();
    expect(range.z).toBe(10);
    expect(range.f).toEqual([96, 127]); // scale 2^(10-5)=32
    expect(range.x).toEqual([768, 1023]); // scale 2^(10-2)=256
    expect(range.y).toEqual([1, 1]); // 既にズーム10
  });

  it("FlexIdの時間Segmentは、RangeId上の等価なIntervalへ対応する", () => {
    const flex = FlexId.create(3, 1, 3, 1, 3, 1).withTime(25, 7); // 2^(35-25)=1024秒
    const range = flex.toRangeId();
    expect(range.interval.seconds()).toBe(1024);
    expect(range.t).toEqual([7, 7]);
  });
});

describe("RangeId.toString（文字列化）", () => {
  it("各軸が範囲の場合は{z}/{f1}:{f2}/{x1}:{x2}/{y1}:{y2}形式で出力する", () => {
    const range = RangeId.create(4, [-3, 6], [8, 9], [5, 10]);
    expect(range.toString()).toBe("4/-3:6/8:9/5:10");
  });

  it("両端が等しい軸は自動的に単一値に圧縮される", () => {
    const range = RangeId.create(4, [-3, -3], [8, 9], [5, 10]);
    expect(range.toString()).toBe("4/-3/8:9/5:10");
  });

  it("全軸が単一値ならSingleIdと同じ{z}/{f}/{x}/{y}形式になる", () => {
    const range = RangeId.create(4, -3, 8, 5);
    expect(range.toString()).toBe("4/-3/8/5");
  });

  it("時間付きのRangeIdを正しく文字列化する（時間の範囲および単一値）", () => {
    const rangeWithSpan = RangeId.create(4, [-3, 6], [8, 9], [5, 10]).withTime(
      3600,
      [0, 2],
    );
    expect(rangeWithSpan.toString()).toBe("4/-3:6/8:9/5:10_3600/0:2");

    const rangeWithSingleT = RangeId.create(
      4,
      [-3, 6],
      [8, 9],
      [5, 10],
    ).withTime(3600, 0);
    expect(rangeWithSingleT.toString()).toBe("4/-3:6/8:9/5:10_3600/0");
  });

  it("テンプレートリテラルで自動的に文字列化される", () => {
    const range = RangeId.create(4, [-3, 6], [8, 9], [5, 10]);
    expect(`${range}`).toBe("4/-3:6/8:9/5:10");
  });
});

describe("RangeId.parse（文字列からの復元）", () => {
  it("範囲表記を含む文字列表現から正しく復元できる", () => {
    const range = RangeId.parse("4/-3:6/8:9/5:10");
    expect(range.z).toBe(4);
    expect(range.f).toEqual([-3, 6]);
    expect(range.x).toEqual([8, 9]);
    expect(range.y).toEqual([5, 10]);
    expect(range.isWholeTime()).toBe(true);
  });

  it("一部または全部が単一値の文字列表現から正しく復元できる", () => {
    const mixed = RangeId.parse("4/-3/8:9/5:10");
    expect(mixed.f).toEqual([-3, -3]);
    expect(mixed.x).toEqual([8, 9]);
    expect(mixed.y).toEqual([5, 10]);

    const allSingle = RangeId.parse("4/-3/8/5");
    expect(allSingle.f).toEqual([-3, -3]);
    expect(allSingle.x).toEqual([8, 8]);
    expect(allSingle.y).toEqual([5, 5]);
  });

  it("時間付きの文字列表現から正しく復元できる", () => {
    const withSpan = RangeId.parse("4/-3:6/8:9/5:10_3600/0:2");
    expect(withSpan.interval.seconds()).toBe(3600);
    expect(withSpan.t).toEqual([0, 2]);

    const withSingle = RangeId.parse("4/-3:6/8:9/5:10_3600/0");
    expect(withSingle.interval.seconds()).toBe(3600);
    expect(withSingle.t).toEqual([0, 0]);
  });

  it("toString()の出力をparse()で元通り復元できる（ラウンドトリップ）", () => {
    const original = RangeId.create(4, [-3, 6], [8, 9], [5, 10]).withTime(
      3600,
      [1, 3],
    );
    const restored = RangeId.parse(original.toString());
    expect(restored.z).toBe(original.z);
    expect(restored.f).toEqual(original.f);
    expect(restored.x).toEqual(original.x);
    expect(restored.y).toEqual(original.y);
    expect(restored.interval.seconds()).toBe(original.interval.seconds());
    expect(restored.t).toEqual(original.t);
  });

  it("構文不正な文字列はParseSpatialIdFormatエラーを投げる", () => {
    expect(() => RangeId.parse("invalid")).toThrow(SpatialIdError);
    expect(() => RangeId.parse("4/-3:6/8:9")).toThrow(SpatialIdError);
    expect(() => RangeId.parse("4/-3:6/8:9/5:10/1")).toThrow(SpatialIdError);
    expect(() => RangeId.parse("4/-3:6/8:9/5:10_")).toThrow(SpatialIdError);
    expect(() => RangeId.parse("4/-3:6:9/8:9/5:10")).toThrow(SpatialIdError); // コロンが2個
    expect(() => RangeId.parse("4/a:6/8:9/5:10")).toThrow(SpatialIdError);
  });

  it("範囲外の値を含む文字列は該当の検証エラーを投げる", () => {
    expect(() => RangeId.parse("68/-3:6/8:9/5:10")).toThrow(SpatialIdError);
    expect(() => RangeId.parse("4/-3:29/8:9/5:10")).toThrow(SpatialIdError);
  });
});
