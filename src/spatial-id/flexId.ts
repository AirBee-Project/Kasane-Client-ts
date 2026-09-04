import { SpatialIdError } from "./error";
import { parseInteger } from "./helpers";
import { Interval } from "./interval";
import { RangeId } from "./rangeId";
import type { SingleId } from "./singleId";
import { checkTIndex, checkTZoom, segmentSeconds } from "./timeZoomLevel";
import { checkF, checkX, checkY, checkZoom } from "./zoomLevel";

export class FlexId {
  public readonly fZoomLevel: number;
  public readonly fIndex: number;
  public readonly xZoomLevel: number;
  public readonly xIndex: number;
  public readonly yZoomLevel: number;
  public readonly yIndex: number;
  public readonly tZoomLevel: number;
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
   * 検証を行わずに {@link FlexId} を作成する。
   *
   * {@link FlexId.create} と異なり、各ズームレベル・インデックスに対して一切の範囲チェックを
   * 行わない。高速に作成できるが、**不正な値を渡した場合の以降の挙動は未定義**になる。
   *
   * 呼び出し側は、`fZoomLevel`/`xZoomLevel`/`yZoomLevel` が有効なズームレベル（`0..=30`）であり、
   * `fIndex`/`xIndex`/`yIndex` がそれぞれ対応するズームレベルの範囲内にあることを保証しなければ
   * ならない。
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
   * 時間Segment（4軸目）を設定した自身を返す。引数は空間3軸と同じく「ズームレベル＋インデックス」で、
   * 1Segmentは `2^(35 - tZoomLevel)` 秒。{@link FlexId} は木のノードアドレスであり2分岐Segment1個
   * しか持てないため、秒数の`interval`ではなくズームで指定する。
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

  /** 全時間（時間を指定していない状態）であるかを返す。 */
  public isWholeTime(): boolean {
    return this.tZoomLevel === 0 && this.tIndex === 0;
  }

  /**
   * この {@link FlexId} を文字列形式で出力する。
   *
   * 形式は `"{fz}/{fi}|{xz}/{xi}|{yz}/{yi}"`。時間を持つ場合は同じ `|` 区切りで
   * 4軸目 `"|{tz}/{ti}"` が続く（`_` は使用しない）。
   */
  public toString(): string {
    const base = `${this.fZoomLevel}/${this.fIndex}|${this.xZoomLevel}/${this.xIndex}|${this.yZoomLevel}/${this.yIndex}`;
    if (this.isWholeTime()) {
      return base;
    }
    return `${base}|${this.tZoomLevel}/${this.tIndex}`;
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
   * この {@link FlexId} を、F/X/Y それぞれの最大ズームに揃えて拡大した {@link RangeId} へ変換する。
   * 時間Segmentは、同じ単位（`2^(35 - tZoomLevel)` 秒）・単一インデックスの {@link RangeId} の時間へ
   * そのまま対応する。
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

  /** この {@link FlexId} が占める領域をちょうど覆う {@link SingleId} の列へ展開する。 */
  public toSingleIds(): Generator<SingleId> {
    return this.toRangeId().toSingleIds();
  }

  /** {@link FlexId} は既にFlexTreeのノードアドレスそのものなので、自身1個だけを列挙する。 */
  public *[Symbol.iterator](): Generator<FlexId> {
    yield this;
  }
}
