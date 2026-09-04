import { describe, expect, it } from "vitest";
import { SpatialIdError } from "../error";
import { FlexId } from "../flexId";

describe("FlexId.create（生成と検証）", () => {
  it("各軸が独立したズームレベルを持て、時間は全時間から始まる", () => {
    const id = FlexId.create(5, 3, 2, 3, 10, 1);
    expect(id.fZoomLevel).toBe(5);
    expect(id.fIndex).toBe(3);
    expect(id.xZoomLevel).toBe(2);
    expect(id.xIndex).toBe(3);
    expect(id.yZoomLevel).toBe(10);
    expect(id.yIndex).toBe(1);
    expect(id.tZoomLevel).toBe(0);
    expect(id.tIndex).toBe(0);
  });

  it("自身のズームに対して範囲外のインデックスはエラーを投げる", () => {
    expect(() => FlexId.create(2, 99, 2, 0, 2, 0)).toThrow(SpatialIdError);
  });
});

describe("FlexId.createUnchecked（検証なしの生成）", () => {
  it("検証を行わずに値をそのまま保持する", () => {
    const id = FlexId.createUnchecked(2, 99, 2, 0, 2, 0);
    expect(id.fZoomLevel).toBe(2);
    expect(id.fIndex).toBe(99);
    expect(id.tZoomLevel).toBe(0);
    expect(id.tIndex).toBe(0);
  });
});

describe("FlexId.withTime（時間セグメントの設定）", () => {
  it("ズーム+インデックスで時間Segmentを設定する(ズーム25=1024秒)", () => {
    const id = FlexId.create(5, 3, 2, 3, 10, 1).withTime(25, 7);
    expect(id.tZoomLevel).toBe(25);
    expect(id.tIndex).toBe(7);
  });

  it("時間ズームの上限35を超えるとエラーを投げる", () => {
    expect(() => FlexId.create(5, 3, 2, 3, 10, 1).withTime(60, 0)).toThrow(
      SpatialIdError,
    );
  });

  it("そのズームに対して範囲外の時間インデックスはエラーを投げる", () => {
    expect(() => FlexId.create(5, 3, 2, 3, 10, 1).withTime(2, 99)).toThrow(
      SpatialIdError,
    );
  });
});

describe("FlexId（FlexIdイテレータとしての展開）", () => {
  it("既に末端ノードなので自身1個だけを返す", () => {
    const flex = FlexId.create(5, 3, 2, 3, 10, 1);
    expect([...flex]).toEqual([flex]);
  });
});

describe("FlexId.toSingleIds（SingleIdへの展開）", () => {
  it("空間3軸のズームが全て一致していればSingleIdは1個になる", () => {
    const flex = FlexId.create(3, 1, 3, 1, 3, 1);
    const singles = [...flex.toSingleIds()];
    expect(singles).toHaveLength(1);
    const [single] = singles;
    expect(single?.z).toBe(3);
    expect(single?.f).toBe(1);
    expect(single?.x).toBe(1);
    expect(single?.y).toBe(1);
  });
});

describe("FlexId.toString（文字列化）", () => {
  it("全時間のFlexIdを{fz}/{fi}|{xz}/{xi}|{yz}/{yi}形式で出力する", () => {
    const flex = FlexId.create(5, 3, 2, 3, 10, 1);
    expect(flex.toString()).toBe("5/3|2/3|10/1");
  });

  it("時間付きのFlexIdを{fz}/{fi}|{xz}/{xi}|{yz}/{yi}|{tz}/{ti}形式で出力する（_は使わない）", () => {
    const flex = FlexId.create(5, 3, 2, 3, 10, 1).withTime(25, 7);
    expect(flex.toString()).toBe("5/3|2/3|10/1|25/7");
  });

  it("テンプレートリテラルで自動的に文字列化される", () => {
    const flex = FlexId.create(5, 3, 2, 3, 10, 1);
    expect(`${flex}`).toBe("5/3|2/3|10/1");
  });
});

describe("FlexId.parse（文字列からの復元）", () => {
  it("全時間の文字列表現から正しく復元できる", () => {
    const flex = FlexId.parse("5/3|2/3|10/1");
    expect(flex.fZoomLevel).toBe(5);
    expect(flex.fIndex).toBe(3);
    expect(flex.xZoomLevel).toBe(2);
    expect(flex.xIndex).toBe(3);
    expect(flex.yZoomLevel).toBe(10);
    expect(flex.yIndex).toBe(1);
    expect(flex.isWholeTime()).toBe(true);
  });

  it("時間付きの文字列表現から正しく復元できる", () => {
    const flex = FlexId.parse("5/3|2/3|10/1|25/7");
    expect(flex.fZoomLevel).toBe(5);
    expect(flex.fIndex).toBe(3);
    expect(flex.xZoomLevel).toBe(2);
    expect(flex.xIndex).toBe(3);
    expect(flex.yZoomLevel).toBe(10);
    expect(flex.yIndex).toBe(1);
    expect(flex.tZoomLevel).toBe(25);
    expect(flex.tIndex).toBe(7);
  });

  it("toString()の出力をparse()で元通り復元できる（ラウンドトリップ）", () => {
    const original = FlexId.create(5, 3, 2, 3, 10, 1).withTime(25, 7);
    const restored = FlexId.parse(original.toString());
    expect(restored.fZoomLevel).toBe(original.fZoomLevel);
    expect(restored.fIndex).toBe(original.fIndex);
    expect(restored.xZoomLevel).toBe(original.xZoomLevel);
    expect(restored.xIndex).toBe(original.xIndex);
    expect(restored.yZoomLevel).toBe(original.yZoomLevel);
    expect(restored.yIndex).toBe(original.yIndex);
    expect(restored.tZoomLevel).toBe(original.tZoomLevel);
    expect(restored.tIndex).toBe(original.tIndex);
  });

  it("構文不正な文字列はParseSpatialIdFormatエラーを投げる", () => {
    expect(() => FlexId.parse("invalid")).toThrow(SpatialIdError);
    expect(() => FlexId.parse("5/3|2/3")).toThrow(SpatialIdError); // 2要素
    expect(() => FlexId.parse("5/3|2/3|10/1|25/7|1/1")).toThrow(SpatialIdError); // 5要素
    expect(() => FlexId.parse("5/3_2/3|10/1")).toThrow(SpatialIdError); // _は不可
    expect(() => FlexId.parse("5|2/3|10/1")).toThrow(SpatialIdError); // スラッシュなし
    expect(() => FlexId.parse("5/a|2/3|10/1")).toThrow(SpatialIdError); // 非数値
  });

  it("範囲外の値を含む文字列は該当の検証エラーを投げる", () => {
    expect(() => FlexId.parse("68/3|2/3|10/1")).toThrow(SpatialIdError);
    expect(() => FlexId.parse("2/99|2/0|2/0")).toThrow(SpatialIdError);
  });
});
