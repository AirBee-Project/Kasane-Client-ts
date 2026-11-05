import { GeometryError } from "./error.js";

/**
 * 同一点判定や閉合性検証に使う、許容誤差（メートル）。
 *
 * 浮動小数点演算の誤差を吸収するために使う。
 */
export class Epsilon {
  /**
   * 既定の許容誤差（1 µm）。
   *
   * 地球規模の ECEF 座標（約 6.4e6 m）では f64 の分解能が約 1e-9 m のため、
   * それより十分大きく、空間 ID の最大ズームレベルの大きさより十分小さい値にしている。
   */
  public static readonly DEFAULT: Epsilon = new Epsilon(1e-6);

  /** 許容誤差ゼロ。 */
  public static readonly ZERO: Epsilon = new Epsilon(0);

  private readonly meters: number;

  private constructor(meters: number) {
    this.meters = meters;
  }

  /**
   * メートル単位の値から {@link Epsilon} を作成する。`0` は許容される。
   *
   * @throws {@link GeometryError} `EpsilonOutOfRange` 負数、`NaN`、無限大のとき
   */
  public static fromMeters(meters: number): Epsilon {
    if (!(meters >= 0 && Number.isFinite(meters))) {
      throw new GeometryError({ kind: "EpsilonOutOfRange", epsilon: meters });
    }
    return new Epsilon(meters);
  }

  /** メートル単位の値を返す。 */
  public asMeters(): number {
    return this.meters;
  }

  /** `"{meters} m"` の形式で出力する。 */
  public toString(): string {
    return `${this.meters} m`;
  }
}
