import type { RangeId } from "../../spatial-id/rangeId.js";
import type { SingleId } from "../../spatial-id/singleId.js";
import { Coordinate } from "../coordinate.js";
import { Epsilon } from "../epsilon.js";
import { GeometryError } from "../error.js";
import type { Vec3 } from "../vec3.js";
import { Polygon } from "./polygon.js";
import { Shape } from "./shape.js";
import { Solid } from "./solid.js";

/** 側面の分割数の下限。 */
const MIN_DIVIDE_NUM = 57;

/**
 * 両端の中心と半径（m）で表す円柱。
 *
 * @category Shape
 */
export class Cylinder extends Shape {
  /** 一方の底面の中心。 */
  public readonly start: Coordinate;
  /** もう一方の底面の中心。 */
  public readonly end: Coordinate;
  /** 半径（m）。 */
  public readonly radiusM: number;

  private constructor(start: Coordinate, end: Coordinate, radiusM: number) {
    super();
    this.start = start;
    this.end = end;
    this.radiusM = radiusM;
  }

  /**
   * 両端の中心と半径から {@link Cylinder} を作成する。
   *
   * @throws {@link GeometryError} `RadiusNegative` `radiusM` が正でない（`NaN` を含む）とき
   */
  public static create(
    start: Coordinate,
    end: Coordinate,
    radiusM: number,
  ): Cylinder {
    if (!(radiusM > 0)) {
      throw new GeometryError({ kind: "RadiusNegative", radius: radiusM });
    }
    return new Cylinder(start, end, radiusM);
  }

  public center(): Coordinate {
    return Coordinate.centroid([this.start, this.end]);
  }

  /**
   * 円柱を 57 角柱で近似した {@link Solid} を返す。
   * 頂点は共有されて一致するので、許容誤差は `0` にしている。
   */
  public roughSolid(): Solid {
    return Solid.create(this.surfaces(MIN_DIVIDE_NUM), Epsilon.ZERO);
  }

  /**
   * ズームレベル `z` のボクセルに対して十分細かくなるよう、分割数を増やした近似の面を返す。
   * 分割数は 57 以上で、半径が大きいほど増える。
   */
  public roughSurfacesWithZ(z: number): Polygon[] {
    const divideNum = Math.max(
      MIN_DIVIDE_NUM,
      Math.floor((this.radiusM * Math.PI) / (2 ** (25 - z) * 3)),
    );
    return this.surfaces(divideNum);
  }

  /**
   * 円柱が覆う {@link SingleId} を返す。内部も含む。
   * 57 角柱で近似した {@link Solid} の結果を使う。
   *
   * @throws {@link spatial-id!SpatialIdError} `ZOutOfRange` `z` が範囲外のとき
   */
  public coverSingleIds(z: number): SingleId[] {
    return this.roughSolid().coverSingleIds(z);
  }

  /**
   * 円柱が覆う範囲を {@link RangeId} で返す。{@link Cylinder.coverSingleIds} と同じ範囲を表す。
   *
   * @throws {@link spatial-id!SpatialIdError} `ZOutOfRange` `z` が範囲外のとき
   */
  public coverRangeIds(z: number): RangeId[] {
    return this.roughSolid().coverRangeIds(z);
  }

  /** 側面を `divideNum` 個の四角形、両底面を 1 つずつの多角形で近似した面を返す。 */
  private surfaces(divideNum: number): Polygon[] {
    const vecs: [Vec3, Vec3] = [this.start.toVec3(), this.end.toVec3()];
    const vecN = vecs[1].sub(vecs[0]);
    const [basis0, basis1] = vecN
      .createOrthonormalBasis()
      .map((v) => v.scale(this.radiusM)) as [Vec3, Vec3];

    const vertices = Array.from({ length: divideNum }, (_, i) => {
      const theta = (2.0 * Math.PI * i) / divideNum;
      const v = basis0
        .scale(Math.cos(theta))
        .add(basis1.scale(Math.sin(theta)));
      return [vecs[0].add(v), vecs[1].add(v)] as const;
    });

    // 共有頂点は同じ Vec3 から計算されてビット単位で一致するので、許容誤差は不要。
    // 既定値を使うと、許容誤差より細い円柱が縮退して面が消える。
    const toCoord = (v: Vec3): Coordinate => Coordinate.fromVec3(v);

    const polygons: Polygon[] = vertices.map((current, i) => {
      const next = vertices[(i + 1) % divideNum] as (typeof vertices)[number];
      return Polygon.create(
        [
          toCoord(current[0]),
          toCoord(next[0]),
          toCoord(next[1]),
          toCoord(current[1]),
        ],
        Epsilon.ZERO,
      );
    });

    polygons.push(
      Polygon.create(
        [...vertices].reverse().map((v) => toCoord(v[0])),
        Epsilon.ZERO,
      ),
    );
    polygons.push(
      Polygon.create(
        vertices.map((v) => toCoord(v[1])),
        Epsilon.ZERO,
      ),
    );
    return polygons;
  }
}
