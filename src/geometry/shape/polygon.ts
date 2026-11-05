import type { SingleId } from "../../spatial-id/singleId.js";
import { Coordinate } from "../coordinate.js";
import type { Ecef } from "../ecef.js";
import { Epsilon } from "../epsilon.js";
import type { Line } from "./line.js";
import { Shape, VoxelSet } from "./shape.js";
import { Triangle } from "./triangle.js";

type Point2 = readonly [number, number];

/**
 * 同一平面上にある頂点の列で表す多角形。
 *
 * 頂点が 3 つに満たない場合は、頂点を持たない空の {@link Polygon} になる。
 *
 * @category Shape
 */
export class Polygon extends Shape {
  private readonly _vertices: readonly Coordinate[];

  private constructor(vertices: readonly Coordinate[]) {
    super();
    this._vertices = vertices;
  }

  /**
   * 頂点の列から {@link Polygon} を作成する。
   *
   * 次の整理をしたうえで、頂点が 3 つに満たなければ空にする。
   * - 直前の頂点と `epsilon` 以内の頂点を取り除く
   * - 始点と終点が `epsilon` 以内なら、終点を取り除く
   */
  public static create(
    rawPoints: readonly Coordinate[],
    epsilon: Epsilon = Epsilon.DEFAULT,
  ): Polygon {
    const vertices: Coordinate[] = [];
    for (const point of rawPoints) {
      const last = vertices[vertices.length - 1];
      if (last?.eqEpsilon(point, epsilon)) {
        continue;
      }
      vertices.push(point);
    }

    if (
      vertices.length > 1 &&
      (vertices[0] as Coordinate).eqEpsilon(
        vertices[vertices.length - 1] as Coordinate,
        epsilon,
      )
    ) {
      vertices.pop();
    }

    return new Polygon(vertices.length < 3 ? [] : vertices);
  }

  /** 頂点の列。空の {@link Polygon} では空。 */
  public get vertices(): readonly Coordinate[] {
    return this._vertices;
  }

  public center(): Coordinate {
    return Coordinate.centroid(this._vertices);
  }

  /** 頂点の {@link Coordinate} に分解する。 */
  public expandCoordinates(): Coordinate[] {
    return [...this._vertices];
  }

  /** 三角形分割したときの、各三角形の辺を {@link Line} で返す。 */
  public expandLines(): Line[] {
    return this.expandTriangles().flatMap((t) => t.expandLines());
  }

  /**
   * 耳切り法で {@link Triangle} に分割する。
   *
   * 頂点を最も面積の大きい座標平面へ投影して判定する。
   * 分割できなかった頂点（自己交差など）は取りこぼす。
   */
  public expandTriangles(): Triangle[] {
    const vertices = this._vertices;
    const n = vertices.length;
    if (n < 3) {
      return [];
    }
    if (n === 3) {
      return [
        Triangle.create([
          vertices[0] as Coordinate,
          vertices[1] as Coordinate,
          vertices[2] as Coordinate,
        ]),
      ];
    }

    const ecefPoints = vertices.map((c) => c.toEcef());
    const [uAxis, vAxis] = projectionAxes(ecefPoints);
    const points2d: Point2[] = ecefPoints.map((p) => [
      p.component(uAxis),
      p.component(vAxis),
    ]);

    const areaSign = signedArea(points2d) > 0 ? 1.0 : -1.0;

    const indices = Array.from({ length: n }, (_, i) => i);
    const result: Triangle[] = [];
    let count = 0;
    const maxIters = n * n;

    while (indices.length > 3 && count < maxIters) {
      let earFound = false;
      const len = indices.length;

      for (let i = 0; i < len; i++) {
        const prev = indices[(i + len - 1) % len] as number;
        const curr = indices[i] as number;
        const next = indices[(i + 1) % len] as number;

        if (isEar(prev, curr, next, indices, points2d, areaSign)) {
          result.push(
            Triangle.create([
              vertices[prev] as Coordinate,
              vertices[curr] as Coordinate,
              vertices[next] as Coordinate,
            ]),
          );
          indices.splice(i, 1);
          earFound = true;
          break;
        }
      }
      if (!earFound) {
        break;
      }
      count += 1;
    }

    if (indices.length === 3) {
      result.push(
        Triangle.create([
          vertices[indices[0] as number] as Coordinate,
          vertices[indices[1] as number] as Coordinate,
          vertices[indices[2] as number] as Coordinate,
        ]),
      );
    }
    return result;
  }

  /**
   * 多角形が覆う {@link SingleId} を返す。三角形分割した各三角形の結果を合わせる。
   *
   * @throws {@link spatial-id!SpatialIdError} `ZOutOfRange` `z` が範囲外のとき
   */
  public coverSingleIds(z: number): SingleId[] {
    const unique = new VoxelSet();
    for (const triangle of this.expandTriangles()) {
      for (const id of triangle.coverSingleIds(z)) {
        unique.add(id);
      }
    }
    return unique.values();
  }
}

/** 法線の成分が最大の軸を落として、投影先の 2 軸を返す。 */
function projectionAxes(pts: readonly Ecef[]): [0 | 1 | 2, 0 | 1 | 2] {
  let nx = 0;
  let ny = 0;
  let nz = 0;

  for (let i = 0; i < pts.length; i++) {
    const curr = pts[i] as Ecef;
    const next = pts[(i + 1) % pts.length] as Ecef;

    nx += (curr.y - next.y) * (curr.z + next.z);
    ny += (curr.z - next.z) * (curr.x + next.x);
    nz += (curr.x - next.x) * (curr.y + next.y);
  }

  const ax = Math.abs(nx);
  const ay = Math.abs(ny);
  const az = Math.abs(nz);

  if (ax >= ay && ax >= az) {
    return [1, 2];
  }
  if (ay >= ax && ay >= az) {
    return [0, 2];
  }
  return [0, 1];
}

function signedArea(pts: readonly Point2[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    const pi = pts[i] as Point2;
    const pj = pts[j] as Point2;
    area += pi[0] * pj[1];
    area -= pj[0] * pi[1];
  }
  return area / 2;
}

function isEar(
  p: number,
  c: number,
  n: number,
  indices: readonly number[],
  pts: readonly Point2[],
  areaSign: number,
): boolean {
  const a = pts[p] as Point2;
  const b = pts[c] as Point2;
  const cPt = pts[n] as Point2;

  const cross =
    (b[0] - a[0]) * (cPt[1] - b[1]) - (b[1] - a[1]) * (cPt[0] - b[0]);

  // 凹頂点は耳にならない
  if (cross * areaSign <= -1e-10) {
    return false;
  }

  for (const idx of indices) {
    if (idx === p || idx === c || idx === n) {
      continue;
    }
    if (isPointInTriangle(pts[idx] as Point2, a, b, cPt)) {
      return false;
    }
  }
  return true;
}

function isPointInTriangle(
  p: Point2,
  a: Point2,
  b: Point2,
  c: Point2,
): boolean {
  const area2 =
    0.5 *
    (-b[1] * c[0] + a[1] * (-b[0] + c[0]) + a[0] * (b[1] - c[1]) + b[0] * c[1]);
  if (Math.abs(area2) < 1e-12) {
    return false;
  }
  const s =
    (1.0 / (2.0 * area2)) *
    (a[1] * c[0] - a[0] * c[1] + (c[1] - a[1]) * p[0] + (a[0] - c[0]) * p[1]);
  const t =
    (1.0 / (2.0 * area2)) *
    (a[0] * b[1] - a[1] * b[0] + (a[1] - b[1]) * p[0] + (b[0] - a[0]) * p[1]);
  return s > 0.0 && t > 0.0 && 1.0 - s - t > 0.0;
}
