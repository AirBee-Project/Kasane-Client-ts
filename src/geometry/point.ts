import type { RangeId } from "../spatial-id/rangeId.js";
import type { SingleId } from "../spatial-id/singleId.js";
import type { Ecef } from "./ecef.js";
import type { Epsilon } from "./epsilon.js";
import type { FractionalId } from "./fractionalId.js";

/**
 * 現実空間の点に共通する性質。{@link Coordinate}、{@link Ecef}、{@link FractionalId} が継承する。
 *
 * @category Point
 */
export abstract class Point {
  /** この点を {@link Ecef} に変換する。 */
  public abstract toEcef(): Ecef;

  /**
   * この点を、ズームレベル `z` の {@link FractionalId} に変換する。
   *
   * @throws {@link spatial-id!SpatialIdError} `ZOutOfRange` `z` が範囲外のとき
   * @throws {@link GeometryError} `FractionalFOutOfRange` `FractionalXOutOfRange` `FractionalYOutOfRange` 変換結果が範囲外のとき
   */
  public abstract fractionalId(z: number): FractionalId;

  /**
   * この点を含む、ズームレベル `z` のボクセルの {@link SingleId} を返す。
   *
   * 高度・経度・緯度が上端ちょうどにある点は、最後のインデックス値に丸める。
   *
   * @throws {@link spatial-id!SpatialIdError} `ZOutOfRange` `z` が範囲外のとき
   */
  public singleId(z: number): SingleId {
    return this.fractionalId(z).roundToSingleId();
  }

  /**
   * この点を含む、ズームレベル `z` のボクセルを {@link RangeId} で返す。
   * 結果は {@link Point.singleId} と同じ範囲を表す。
   *
   * @throws {@link spatial-id!SpatialIdError} `ZOutOfRange` `z` が範囲外のとき
   */
  public rangeId(z: number): RangeId {
    return this.singleId(z).toRangeId();
  }

  /** この点を覆う {@link SingleId} を返す。常に 1 件。 */
  public coverSingleIds(z: number): SingleId[] {
    return [this.singleId(z)];
  }

  /** 2 点間のユークリッド距離（m）が `epsilon` 以内かを判定する。 */
  public eqEpsilon(other: Point, epsilon: Epsilon): boolean {
    return this.toEcef().distance(other.toEcef()) <= epsilon.asMeters();
  }
}
