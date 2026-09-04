import { SpatialIdError } from "./error";
import { TIME_MAX_ZOOM } from "./timeZoomLevel";

/** {@link Interval.create} と {@link Interval} 自身のどちらでも渡せる時間間隔の入力。 */
export type IntervalInput = Interval | number;

/**
 * 時間 ID の時間間隔 `{i}`（秒数）を表現する型。よく使う値は定数として用意している。
 */
export class Interval {
  /** このライブラリが扱える最大の時間間隔＝全時間の秒数（`2^35` 秒、約1089年）。 */
  public static readonly MAX_SECONDS = 2 ** TIME_MAX_ZOOM;

  private readonly value: number;

  private constructor(seconds: number) {
    this.value = seconds;
  }

  /** 全時間（`2^35`秒）。時間を指定していない ID はこの値を持つ。 */
  public static readonly WHOLE = new Interval(Interval.MAX_SECONDS);
  /** 1日（86400秒）。 */
  public static readonly DAY = new Interval(86_400);
  /** 1時間（3600秒）。 */
  public static readonly HOUR = new Interval(3_600);
  /** 1分（60秒）。 */
  public static readonly MINUTE = new Interval(60);
  /** 1秒。 */
  public static readonly SECOND = new Interval(1);

  /**
   * 秒数から {@link Interval} を作成する。
   * `seconds` が正の整数でない、または {@link Interval.MAX_SECONDS} を超える場合はエラーを投げる。
   */
  public static create(seconds: number): Interval {
    if (
      !Number.isInteger(seconds) ||
      seconds <= 0 ||
      seconds > Interval.MAX_SECONDS
    ) {
      throw new SpatialIdError({ kind: "TIntervalError", i: seconds });
    }
    return new Interval(seconds);
  }

  /** {@link Interval} 自身、または秒数の整数のどちらからでも {@link Interval} を得る。 */
  public static from(input: IntervalInput): Interval {
    return input instanceof Interval ? input : Interval.create(input);
  }

  /** この {@link Interval} の秒数。 */
  public seconds(): number {
    return this.value;
  }

  /**
   * `{i}` と `{t}` の範囲（両端含む）が占める絶対秒区間の終端が {@link Interval.MAX_SECONDS} を
   * 超えないかを検証する。超える場合はエラーを投げる。
   */
  public validatedSpan(tMin: number, tMax: number): void {
    const start = tMin * this.value;
    const end = (tMax + 1) * this.value;
    if (start >= end || end > Interval.MAX_SECONDS) {
      throw new SpatialIdError({ kind: "TOutOfRange", i: this.value, t: tMax });
    }
  }
}
