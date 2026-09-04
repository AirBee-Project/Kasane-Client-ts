import { SpatialIdError } from "./error";
import type { FlexId } from "./flexId";
import { Interval } from "./interval";
import { RangeId } from "./rangeId";
import { checkF, checkX, checkY, checkZoom, parseInteger } from "./utils";

export class SingleId {
  public readonly z: number;
  public readonly f: number;
  public readonly x: number;
  public readonly y: number;
  public readonly interval: Interval;
  public readonly t: number;

  private constructor(
    z: number,
    f: number,
    x: number,
    y: number,
    interval: Interval,
    t: number,
  ) {
    this.z = z;
    this.f = f;
    this.x = x;
    this.y = y;
    this.interval = interval;
    this.t = t;
  }

  /**
   * 指定された値から {@link SingleId} を作成する。
   * `z`, `f`, `x`, `y` が各ズームレベルにおける範囲内にあるかを検証し、範囲外の場合はエラーを投げる。
   * 時間は指定しておらず、全時間（{@link Interval.WHOLE}）となる。。
   */
  public static create(z: number, f: number, x: number, y: number): SingleId {
    checkZoom(z);
    checkF(z, f);
    checkX(z, x);
    checkY(z, y);

    return new SingleId(z, f, x, y, Interval.WHOLE, 0);
  }

  /**
   * 検証を行わずに {@link SingleId} を作成する。
   * 高速に作成できるが、**不正な値を渡した場合の挙動は未定義**になる。
   */
  public static createUnchecked(
    z: number,
    f: number,
    x: number,
    y: number,
  ): SingleId {
    return new SingleId(z, f, x, y, Interval.WHOLE, 0);
  }

  /**
   * 時間を設定する。`interval` は {@link Interval} または秒数のどちらでも渡せる。
   */
  public withTime(interval: Interval | number, t: number): SingleId {
    const resolved = Interval.from(interval);
    resolved.validatedSpan(t, t);
    return new SingleId(this.z, this.f, this.x, this.y, resolved, t);
  }

  /** {@link SingleId} を {@link RangeId} へ変換する。 */
  public toRangeId(): RangeId {
    return RangeId.create(this.z, this.f, this.x, this.y).withTime(
      this.interval,
      this.t,
    );
  }

  /** 全時間を指しているか。 */
  public isWholeTime(): boolean {
    return this.interval.seconds() === Interval.MAX_SECONDS && this.t === 0;
  }

  /**
   * この {@link SingleId} を文字列形式で出力する。
   * 全時間の場合は `"{z}/{f}/{x}/{y}"`、時間を持つ場合は `"{z}/{f}/{x}/{y}_{i}/{t}"`。
   */
  public toString(): string {
    const base = `${this.z}/${this.f}/${this.x}/${this.y}`;
    if (this.isWholeTime()) {
      return base;
    }
    return `${base}_${this.interval.seconds()}/${this.t}`;
  }

  /**
   * 文字列表現から {@link SingleId} を復元する。
   *
   * 形式は `"{z}/{f}/{x}/{y}"`、時間を持つ場合は `"{z}/{f}/{x}/{y}_{i}/{t}"`。
   * 書式不正の場合は {@link SpatialIdError}（`ParseSpatialIdFormat`）を投げる。
   * 各値が範囲外の場合は各検証エラー（{@link SpatialIdError}）を投げる。
   */
  public static parse(text: string): SingleId {
    const underscoreIndex = text.indexOf("_");
    let spatialText = text;
    let temporalText: string | undefined;

    if (underscoreIndex !== -1) {
      spatialText = text.slice(0, underscoreIndex);
      temporalText = text.slice(underscoreIndex + 1);
      if (temporalText.includes("_")) {
        throw new SpatialIdError({
          kind: "ParseSpatialIdFormat",
          idKind: "SingleId",
          input: text,
        });
      }
    }

    const spatialParts = spatialText.split("/");
    if (spatialParts.length !== 4) {
      throw new SpatialIdError({
        kind: "ParseSpatialIdFormat",
        idKind: "SingleId",
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
        idKind: "SingleId",
        input: text,
      });
    }

    const z = parseInteger(zStr);
    const f = parseInteger(fStr);
    const x = parseInteger(xStr);
    const y = parseInteger(yStr);

    if (z === null || f === null || x === null || y === null) {
      throw new SpatialIdError({
        kind: "ParseSpatialIdFormat",
        idKind: "SingleId",
        input: text,
      });
    }

    const id = SingleId.create(z, f, x, y);

    if (temporalText !== undefined) {
      if (temporalText.includes(":")) {
        throw new SpatialIdError({
          kind: "ParseSpatialIdFormat",
          idKind: "SingleId",
          input: text,
        });
      }

      const temporalParts = temporalText.split("/");
      if (temporalParts.length !== 2) {
        throw new SpatialIdError({
          kind: "ParseSpatialIdFormat",
          idKind: "SingleId",
          input: text,
        });
      }

      const [iStr, tStr] = temporalParts;
      if (iStr === undefined || tStr === undefined) {
        throw new SpatialIdError({
          kind: "ParseSpatialIdFormat",
          idKind: "SingleId",
          input: text,
        });
      }

      const i = parseInteger(iStr);
      const t = parseInteger(tStr);
      if (i === null || t === null) {
        throw new SpatialIdError({
          kind: "ParseSpatialIdFormat",
          idKind: "SingleId",
          input: text,
        });
      }

      return id.withTime(i, t);
    }

    return id;
  }

  /** {@link SingleId} を {@link FlexId} へ変換する。 */
  public [Symbol.iterator](): Generator<FlexId> {
    return this.toRangeId()[Symbol.iterator]();
  }
}
