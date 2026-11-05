import type { SingleId } from "../../spatial-id/singleId.js";
import type { Coordinate } from "../coordinate.js";
import { GeometryError } from "../error.js";
import { Cylinder } from "./cylinder.js";
import { VoxelSet } from "./shape.js";
import { Sphere } from "./sphere.js";

/**
 * 折れ線に沿った一定の半径（m）の管。
 *
 * @category Shape
 */
export class Tube {
  /** 折れ線の頂点。 */
  public readonly points: readonly Coordinate[];
  /** 半径（m）。 */
  public readonly radiusM: number;

  private constructor(points: readonly Coordinate[], radiusM: number) {
    this.points = points;
    this.radiusM = radiusM;
  }

  /**
   * 折れ線の頂点と半径から {@link Tube} を作成する。
   *
   * @throws {@link GeometryError} `RadiusNegative` `radiusM` が正でない（`NaN` を含む）とき
   */
  public static create(points: readonly Coordinate[], radiusM: number): Tube {
    if (!(radiusM > 0)) {
      throw new GeometryError({ kind: "RadiusNegative", radius: radiusM });
    }
    return new Tube([...points], radiusM);
  }

  /**
   * 管が覆う {@link SingleId} を返す。内部も含む。
   * 頂点ごとの球と、隣り合う頂点を結ぶ円柱の結果を合わせる。頂点がなければ空。
   *
   * @throws {@link spatial-id!SpatialIdError} `ZOutOfRange` `z` が範囲外のとき
   */
  public coverSingleIds(z: number): SingleId[] {
    const first = this.points[0];
    if (first === undefined) {
      return [];
    }

    const ids = new VoxelSet();
    for (const id of Sphere.create(first, this.radiusM).coverSingleIds(z)) {
      ids.add(id);
    }
    for (let i = 0; i + 1 < this.points.length; i++) {
      const a = this.points[i] as Coordinate;
      const b = this.points[i + 1] as Coordinate;
      for (const id of Cylinder.create(a, b, this.radiusM).coverSingleIds(z)) {
        ids.add(id);
      }
      for (const id of Sphere.create(b, this.radiusM).coverSingleIds(z)) {
        ids.add(id);
      }
    }
    return ids.values();
  }
}
