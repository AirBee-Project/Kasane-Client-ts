import { SpatialIdError } from "./error";
import { FlexId } from "./flexId";
import { Interval } from "./interval";
import { SingleId } from "./singleId";
import {
  checkF,
  checkX,
  checkY,
  checkZoom,
  decomposeF,
  decomposeRange,
  formatDimension,
  intoRange,
  parseDimension,
  parseInteger,
  type RangeInput,
  TIME_MAX_ZOOM,
  xyMax,
} from "./utils";

export class RangeId {
  public readonly z: number;
  public readonly f: [number, number];
  public readonly x: [number, number];
  public readonly y: [number, number];
  public readonly interval: Interval;
  public readonly t: [number, number];

  private constructor(
    z: number,
    f: [number, number],
    x: [number, number],
    y: [number, number],
    interval: Interval,
    t: [number, number],
  ) {
    this.z = z;
    this.f = f;
    this.x = x;
    this.y = y;
    this.interval = interval;
    this.t = t;
  }

  /**
   * 指定された値から {@link RangeId} を作成する。
   * `f`, `x`, `y` は `[min, max]` のペア、または両端が等しい単一の値で指定できる。
   * `f`, `y` は自動的に昇順へ並び替えられる。`x` は周期境界を持つため並び替えない。
   * 各値が対応するズームレベルの範囲内にあるかを検証し、範囲外の場合はエラーを投げる。
   * 時間は指定しておらず、全時間（{@link Interval.WHOLE}）となる。
   */
  public static create(
    z: number,
    f: RangeInput,
    x: RangeInput,
    y: RangeInput,
  ): RangeId {
    checkZoom(z);

    const fRange = intoRange(f);
    const xRange = intoRange(x);
    const yRange = intoRange(y);

    for (const value of fRange) checkF(z, value);
    for (const value of xRange) checkX(z, value);
    for (const value of yRange) checkY(z, value);

    if (fRange[0] > fRange[1]) {
      [fRange[0], fRange[1]] = [fRange[1], fRange[0]];
    }
    if (yRange[0] > yRange[1]) {
      [yRange[0], yRange[1]] = [yRange[1], yRange[0]];
    }

    return new RangeId(z, fRange, xRange, yRange, Interval.WHOLE, [0, 0]);
  }

  /**
   * 検証を行わずに {@link RangeId} を作成する。
   * 高速に作成できるが、**不正な値を渡した場合の挙動は未定義**になる。
   */
  public static createUnchecked(
    z: number,
    f: RangeInput,
    x: RangeInput,
    y: RangeInput,
  ): RangeId {
    return new RangeId(
      z,
      intoRange(f),
      intoRange(x),
      intoRange(y),
      Interval.WHOLE,
      [0, 0],
    );
  }

  /**
   * 時間を設定する。`interval` は {@link Interval} または秒数のどちらでも渡せる。
   * `t` は `[min, max]` のペア、または両端が等しい単一の値で指定できる。
   */
  public withTime(interval: Interval | number, t: RangeInput): RangeId {
    const resolved = Interval.from(interval);
    const tRange = intoRange(t);
    if (tRange[0] > tRange[1]) {
      [tRange[0], tRange[1]] = [tRange[1], tRange[0]];
    }
    resolved.validatedSpan(tRange[0], tRange[1]);

    return new RangeId(this.z, this.f, this.x, this.y, resolved, tRange);
  }

  /** 全時間を指しているか。 */
  public isWholeTime(): boolean {
    return (
      this.interval.seconds() === Interval.MAX_SECONDS &&
      this.t[0] === 0 &&
      this.t[1] === 0
    );
  }

  /**
   * この {@link RangeId} を文字列形式で出力する。
   * 形式は `"{z}/{f}/{x}/{y}"`、時間を持つ場合は `"{z}/{f}/{x}/{y}_{i}/{t}"`。
   * 各軸は両端が等しい場合は単一値に自動圧縮される（例: `4/-3/8:9/5:10`）。
   */
  public toString(): string {
    const base = `${this.z}/${formatDimension(this.f)}/${formatDimension(this.x)}/${formatDimension(this.y)}`;
    if (this.isWholeTime()) {
      return base;
    }
    return `${base}_${this.interval.seconds()}/${formatDimension(this.t)}`;
  }

  /**
   * 文字列表現から {@link RangeId} を復元する。
   *
   * 形式は `"{z}/{f}/{x}/{y}"`、時間を持つ場合は `"{z}/{f}/{x}/{y}_{i}/{t}"`。
   * 単一値表記（例: `4/-3/8:9/5:10`）および範囲表記（例: `4/-3:6/8:9/5:10`）の両方を受け付ける。
   * 書式不正の場合は {@link SpatialIdError}（`ParseSpatialIdFormat`）を投げる。
   * 各値が範囲外の場合は各検証エラー（{@link SpatialIdError}）を投げる。
   */
  public static parse(text: string): RangeId {
    const underscoreIndex = text.indexOf("_");
    let spatialText = text;
    let temporalText: string | undefined;

    if (underscoreIndex !== -1) {
      spatialText = text.slice(0, underscoreIndex);
      temporalText = text.slice(underscoreIndex + 1);
      if (temporalText.includes("_")) {
        throw new SpatialIdError({
          kind: "ParseSpatialIdFormat",
          idKind: "RangeId",
          input: text,
        });
      }
    }

    const spatialParts = spatialText.split("/");
    if (spatialParts.length !== 4) {
      throw new SpatialIdError({
        kind: "ParseSpatialIdFormat",
        idKind: "RangeId",
        input: text,
      });
    }

    const [zStr, fStr, xStr, yStr] = spatialParts;
    if (
      zStr === undefined ||
      fStr === undefined ||
      xStr === undefined ||
      yStr === undefined
    ) {
      throw new SpatialIdError({
        kind: "ParseSpatialIdFormat",
        idKind: "RangeId",
        input: text,
      });
    }

    const z = parseInteger(zStr);
    if (z === null) {
      throw new SpatialIdError({
        kind: "ParseSpatialIdFormat",
        idKind: "RangeId",
        input: text,
      });
    }

    const f = parseDimension(fStr);
    const x = parseDimension(xStr);
    const y = parseDimension(yStr);

    if (f === null || x === null || y === null) {
      throw new SpatialIdError({
        kind: "ParseSpatialIdFormat",
        idKind: "RangeId",
        input: text,
      });
    }

    const id = RangeId.create(z, f, x, y);

    if (temporalText !== undefined) {
      const temporalParts = temporalText.split("/");
      if (temporalParts.length !== 2) {
        throw new SpatialIdError({
          kind: "ParseSpatialIdFormat",
          idKind: "RangeId",
          input: text,
        });
      }

      const [iStr, tStr] = temporalParts;
      if (iStr === undefined || tStr === undefined) {
        throw new SpatialIdError({
          kind: "ParseSpatialIdFormat",
          idKind: "RangeId",
          input: text,
        });
      }

      const i = parseInteger(iStr);
      const t = parseDimension(tStr);
      if (i === null || t === null) {
        throw new SpatialIdError({
          kind: "ParseSpatialIdFormat",
          idKind: "RangeId",
          input: text,
        });
      }

      return id.withTime(i, t);
    }

    return id;
  }

  /** `x` の周期境界（`x[0] > x[1]` の折り返し）を考慮して、Xインデックスを列挙する。 */
  private *xIndices(): Generator<number> {
    if (this.x[0] <= this.x[1]) {
      for (let x = this.x[0]; x <= this.x[1]; x++) yield x;
      return;
    }
    for (let x = this.x[0]; x <= xyMax(this.z); x++) yield x;
    for (let x = 0; x <= this.x[1]; x++) yield x;
  }

  /** {@link RangeId} を複数の {@link SingleId} へ展開する。 */
  public *toSingleIds(): Generator<SingleId> {
    for (let f = this.f[0]; f <= this.f[1]; f++) {
      for (const x of this.xIndices()) {
        for (let y = this.y[0]; y <= this.y[1]; y++) {
          for (let t = this.t[0]; t <= this.t[1]; t++) {
            yield SingleId.create(this.z, f, x, y).withTime(this.interval, t);
          }
        }
      }
    }
  }

  /** {@link RangeId} を複数の {@link FlexId} へ展開する。 */
  public *[Symbol.iterator](): Generator<FlexId> {
    const z = this.z;
    const fSegments = [...decomposeF(z, this.f[0], this.f[1])];
    const ySegments = [...decomposeRange(this.y[0], this.y[1], z)];
    const xSegments =
      this.x[0] <= this.x[1]
        ? [...decomposeRange(this.x[0], this.x[1], z)]
        : [
            ...decomposeRange(this.x[0], xyMax(z), z),
            ...decomposeRange(0, this.x[1], z),
          ];

    const start = this.interval.seconds() * this.t[0];
    const end = this.interval.seconds() * (this.t[1] + 1);
    const tSegments = [...decomposeRange(start, end - 1, TIME_MAX_ZOOM)];

    for (const f of fSegments) {
      for (const x of xSegments) {
        for (const y of ySegments) {
          for (const t of tSegments) {
            yield FlexId.create(
              f.zoom,
              f.index,
              x.zoom,
              x.index,
              y.zoom,
              y.index,
            ).withTime(t.zoom, t.index);
          }
        }
      }
    }
  }
}
