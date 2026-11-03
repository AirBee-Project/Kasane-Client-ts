import { SpatialIdError } from "../errors/spatialId.js";
import { Interval } from "./interval.js";
import { RangeId } from "./rangeId.js";
import type { SingleId } from "./singleId.js";
import {
  checkF,
  checkTIndex,
  checkTZoom,
  checkX,
  checkY,
  checkZoom,
  parseInteger,
  segmentSeconds,
} from "./utils.js";

/** 軸ごとに異なるズームレベルを持つ拡張時空間 ID。 */
export class FlexId {
  /** 高度方向のズームレベル。 */
  public readonly fZoomLevel: number;
  /** 高度方向のインデックス。 */
  public readonly fIndex: number;
  /** X 方向のズームレベル。 */
  public readonly xZoomLevel: number;
  /** X 方向のインデックス。 */
  public readonly xIndex: number;
  /** Y 方向のズームレベル。 */
  public readonly yZoomLevel: number;
  /** Y 方向のインデックス。 */
  public readonly yIndex: number;
  /** 時間軸のズームレベル（0 以上 {@link TIME_MAX_ZOOM} 以下）。 */
  public readonly tZoomLevel: number;
  /** 時間軸のインデックス。 */
  public readonly tIndex: number;

  private constructor(
    fZoomLevel: number,
    fIndex: number,
    xZoomLevel: number,
    xIndex: number,
    yZoomLevel: number,
    yIndex: number,
    tZoomLevel: number,
    tIndex: number,
  ) {
    this.fZoomLevel = fZoomLevel;
    this.fIndex = fIndex;
    this.xZoomLevel = xZoomLevel;
    this.xIndex = xIndex;
    this.yZoomLevel = yZoomLevel;
    this.yIndex = yIndex;
    this.tZoomLevel = tZoomLevel;
    this.tIndex = tIndex;
  }

  /**
   * 空間3軸（F/X/Y）からそれぞれ独立したズームレベルで {@link FlexId} を作成する。
   * 各インデックスが対応するズームレベルの範囲内にあるかを検証し、範囲外の場合はエラーを投げる。
   * 時間軸は全時間（ズーム0、インデックス0）から始まる。
   */
  public static create(
    fZoomLevel: number,
    fIndex: number,
    xZoomLevel: number,
    xIndex: number,
    yZoomLevel: number,
    yIndex: number,
  ): FlexId {
    checkZoom(fZoomLevel);
    checkZoom(xZoomLevel);
    checkZoom(yZoomLevel);

    checkF(fZoomLevel, fIndex);
    checkX(xZoomLevel, xIndex);
    checkY(yZoomLevel, yIndex);

    return new FlexId(
      fZoomLevel,
      fIndex,
      xZoomLevel,
      xIndex,
      yZoomLevel,
      yIndex,
      0,
      0,
    );
  }

  /**
   * 文字列表現から {@link FlexId} を復元する。
   *
   * 形式は `"{fz}/{fi}|{xz}/{xi}|{yz}/{yi}"`。時間を持つ場合は 4 軸目 `"|{tz}/{ti}"` が続く。
   * 書式不正の場合は {@link SpatialIdError}（`ParseSpatialIdFormat`）を投げる。
   * 各値が範囲外の場合は各検証エラー（{@link SpatialIdError}）を投げる。
   */
  public static parse(text: string): FlexId {
    const parts = text.split("|");
    if (parts.length !== 3 && parts.length !== 4) {
      throw new SpatialIdError({
        kind: "ParseSpatialIdFormat",
        idKind: "FlexId",
        input: text,
      });
    }

    const parseAxis = (part: string): [number, number] => {
      const subParts = part.split("/");
      if (subParts.length !== 2) {
        throw new SpatialIdError({
          kind: "ParseSpatialIdFormat",
          idKind: "FlexId",
          input: text,
        });
      }
      const [zoomStr, indexStr] = subParts;
      if (zoomStr === undefined || indexStr === undefined) {
        throw new SpatialIdError({
          kind: "ParseSpatialIdFormat",
          idKind: "FlexId",
          input: text,
        });
      }
      const zoom = parseInteger(zoomStr);
      const index = parseInteger(indexStr);
      if (zoom === null || index === null) {
        throw new SpatialIdError({
          kind: "ParseSpatialIdFormat",
          idKind: "FlexId",
          input: text,
        });
      }
      return [zoom, index];
    };

    const [fPart, xPart, yPart, tPart] = parts;
    if (fPart === undefined || xPart === undefined || yPart === undefined) {
      throw new SpatialIdError({
        kind: "ParseSpatialIdFormat",
        idKind: "FlexId",
        input: text,
      });
    }

    const [fz, fi] = parseAxis(fPart);
    const [xz, xi] = parseAxis(xPart);
    const [yz, yi] = parseAxis(yPart);

    const id = FlexId.create(fz, fi, xz, xi, yz, yi);

    if (tPart !== undefined) {
      const [tz, ti] = parseAxis(tPart);
      return id.withTime(tz, ti);
    }

    return id;
  }

  /**
   * 検証を行わずに {@link FlexId} を作成する。
   * 高速に作成できるが、**不正な値を渡した場合の挙動は未定義**になる。
   */
  public static createUnchecked(
    fZoomLevel: number,
    fIndex: number,
    xZoomLevel: number,
    xIndex: number,
    yZoomLevel: number,
    yIndex: number,
  ): FlexId {
    return new FlexId(
      fZoomLevel,
      fIndex,
      xZoomLevel,
      xIndex,
      yZoomLevel,
      yIndex,
      0,
      0,
    );
  }

  /**
   * 時間を設定する。引数は空間と同じくズームレベルとインデックス値である。
   */
  public withTime(tZoomLevel: number, tIndex: number): FlexId {
    checkTZoom(tZoomLevel);
    checkTIndex(tZoomLevel, tIndex);

    return new FlexId(
      this.fZoomLevel,
      this.fIndex,
      this.xZoomLevel,
      this.xIndex,
      this.yZoomLevel,
      this.yIndex,
      tZoomLevel,
      tIndex,
    );
  }

  /** 全時間を指しているか。 */
  public isWholeTime(): boolean {
    return this.tZoomLevel === 0 && this.tIndex === 0;
  }

  /**
   * {@link FlexId} を文字列形式で出力する。
   */
  public toString(): string {
    const base = `${this.fZoomLevel}/${this.fIndex}|${this.xZoomLevel}/${this.xIndex}|${this.yZoomLevel}/${this.yIndex}`;
    if (this.isWholeTime()) {
      return base;
    }
    return `${base}|${this.tZoomLevel}/${this.tIndex}`;
  }

  /**
   * {@link FlexId} を {@link RangeId} へ変換する。
   */
  public toRangeId(): RangeId {
    const maxZoom = Math.max(this.fZoomLevel, this.xZoomLevel, this.yZoomLevel);
    const widen = (zoom: number, index: number): [number, number] => {
      const scale = 2 ** (maxZoom - zoom);
      const start = index * scale;
      return [start, start + scale - 1];
    };

    return RangeId.create(
      maxZoom,
      widen(this.fZoomLevel, this.fIndex),
      widen(this.xZoomLevel, this.xIndex),
      widen(this.yZoomLevel, this.yIndex),
    ).withTime(Interval.create(segmentSeconds(this.tZoomLevel)), this.tIndex);
  }

  /** {@link FlexId} を複数の {@link SingleId} へ展開する。 */
  public toSingleIds(): Generator<SingleId> {
    return this.toRangeId().toSingleIds();
  }

  /** 自身だけを1つ返す。 */
  public *[Symbol.iterator](): Generator<FlexId> {
    yield this;
  }
}
