import { describe, expect, it } from "vitest";
import { SpatialIdError } from "../error.js";
import { TZoomLevel, ZoomLevel } from "../zoomLevel.js";

function expectKind(fn: () => unknown, kind: SpatialIdError["info"]["kind"]) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(SpatialIdError);
    expect((e as SpatialIdError).info.kind).toBe(kind);
    return;
  }
  throw new Error("エラーが投げられなかった");
}

describe("ZoomLevel", () => {
  it("同じズームレベルには同じインスタンスを返す", () => {
    expect(ZoomLevel.create(12)).toBe(ZoomLevel.create(12));
    expect(ZoomLevel.create(12).value).toBe(12);
  });

  it("最小値と最大値のズームレベルを作れる", () => {
    expect(ZoomLevel.create(ZoomLevel.MIN).value).toBe(0);
    expect(ZoomLevel.create(ZoomLevel.MAX).value).toBe(30);
    expect(TZoomLevel.create(TZoomLevel.MIN).value).toBe(0);
    expect(TZoomLevel.create(TZoomLevel.MAX).value).toBe(35);
  });

  it("範囲外や整数でないズームレベルは ZOutOfRange を投げる", () => {
    expectKind(() => ZoomLevel.create(-1), "ZOutOfRange");
    expectKind(() => ZoomLevel.create(ZoomLevel.MAX + 1), "ZOutOfRange");
    expectKind(() => ZoomLevel.create(1.5), "ZOutOfRange");
  });

  it("インデックスの範囲を返す", () => {
    const zoom = ZoomLevel.create(4);
    expect(zoom.xyMax()).toBe(15);
    expect(zoom.fMin()).toBe(-16);
    expect(zoom.fMax()).toBe(15);
    expect(ZoomLevel.create(ZoomLevel.MAX).xyMax()).toBe(2 ** 30 - 1);
  });

  it("範囲外のインデックスは軸ごとのエラーを投げる", () => {
    const zoom = ZoomLevel.create(4);
    expectKind(() => zoom.checkF(-17), "FOutOfRange");
    expectKind(() => zoom.checkX(16), "XOutOfRange");
    expectKind(() => zoom.checkY(-1), "YOutOfRange");
    zoom.checkF(-16);
    zoom.checkX(15);
    zoom.checkY(0);
  });
});

describe("TZoomLevel", () => {
  it("1Segmentの秒数は 2^(MAX - z)", () => {
    expect(TZoomLevel.create(TZoomLevel.MAX).segmentSeconds()).toBe(1);
    expect(TZoomLevel.create(25).segmentSeconds()).toBe(1024);
    expect(TZoomLevel.create(0).segmentSeconds()).toBe(2 ** 35);
  });

  it("範囲外のズームレベルとインデックスはエラーを投げる", () => {
    expectKind(() => TZoomLevel.create(TZoomLevel.MAX + 1), "ZOutOfRange");
    expectKind(() => TZoomLevel.create(3).checkIndex(8), "TOutOfRange");
    TZoomLevel.create(3).checkIndex(7);
  });
});
