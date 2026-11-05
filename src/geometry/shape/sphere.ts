import { SingleId } from "../../spatial-id/singleId.js";
import { ZoomLevel } from "../../spatial-id/zoomLevel.js";
import { WGS84_A } from "../constants.js";
import type { Coordinate } from "../coordinate.js";
import { Ecef } from "../ecef.js";
import { GeometryError } from "../error.js";
import { Shape } from "./shape.js";

/**
 * 中心と半径（m）で表す球。
 *
 * @category Shape
 */
export class Sphere extends Shape {
  private readonly _center: Coordinate;
  /** 半径（m）。 */
  public readonly radiusM: number;

  private constructor(center: Coordinate, radiusM: number) {
    super();
    this._center = center;
    this.radiusM = radiusM;
  }

  /**
   * 中心と半径から {@link Sphere} を作成する。
   *
   * @throws {@link GeometryError} `RadiusNegative` `radiusM` が正でない（`NaN` を含む）とき
   */
  public static create(center: Coordinate, radiusM: number): Sphere {
    if (!(radiusM > 0)) {
      throw new GeometryError({ kind: "RadiusNegative", radius: radiusM });
    }
    return new Sphere(center, radiusM);
  }

  public center(): Coordinate {
    return this._center;
  }

  /**
   * 球が覆う {@link SingleId} を返す。内部も含む。
   *
   * 球に外接する立方体の範囲を調べ、ボクセル中心から球の中心までの距離が
   * 「半径 + ボクセル対角の半分」以内のものを選ぶ。
   *
   * @throws {@link spatial-id!SpatialIdError} `ZOutOfRange` `z` が範囲外のとき
   * @throws {@link GeometryError} 球が座標の範囲を超えるとき
   */
  public coverSingleIds(z: number): SingleId[] {
    ZoomLevel.create(z);

    const center = this._center;
    const radius = this.radiusM;
    const voxelDiagHalf = (voxelLengthXy(z) * Math.sqrt(3.0)) / 2.0;
    const centerEcef = center.toEcef();

    // 球に外接する立方体の 8 頂点から、探索する範囲を決める
    let xMin = Number.POSITIVE_INFINITY;
    let xMax = Number.NEGATIVE_INFINITY;
    let yMin = Number.POSITIVE_INFINITY;
    let yMax = Number.NEGATIVE_INFINITY;
    let fMin = Number.POSITIVE_INFINITY;
    let fMax = Number.NEGATIVE_INFINITY;
    for (const sx of [1.0, -1.0]) {
      for (const sy of [1.0, -1.0]) {
        for (const sz of [1.0, -1.0]) {
          const id = Ecef.create(
            centerEcef.x + radius * sx,
            centerEcef.y + radius * sy,
            centerEcef.z + radius * sz,
          ).singleId(z);
          xMin = Math.min(xMin, id.x);
          xMax = Math.max(xMax, id.x);
          yMin = Math.min(yMin, id.y);
          yMax = Math.max(yMax, id.y);
          fMin = Math.min(fMin, id.f);
          fMax = Math.max(fMax, id.f);
        }
      }
    }

    const ids: SingleId[] = [];
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        for (let f = fMin; f <= fMax; f++) {
          const id = SingleId.create(z, f, x, y);
          if (center.distance(id.spatialCenter()) <= radius + voxelDiagHalf) {
            ids.push(id);
          }
        }
      }
    }
    return ids;
  }
}

/** 赤道上でのボクセルの水平方向の長さ（m）。 */
function voxelLengthXy(z: number): number {
  return (2.0 * Math.PI * WGS84_A) / 2 ** z;
}
