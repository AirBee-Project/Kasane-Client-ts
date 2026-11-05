import { SingleId } from "../../spatial-id/singleId.js";
import { Coordinate } from "../coordinate.js";
import type { FractionalId } from "../fractionalId.js";
import { Vec3 } from "../vec3.js";
import { Line } from "./line.js";
import { Shape, VoxelSet } from "./shape.js";

const EIGHT_PATTERNS: readonly Vec3[] = [
  new Vec3(0, 0, 0),
  new Vec3(0, 0, 1),
  new Vec3(0, 1, 0),
  new Vec3(0, 1, 1),
  new Vec3(1, 0, 0),
  new Vec3(1, 0, 1),
  new Vec3(1, 1, 0),
  new Vec3(1, 1, 1),
];

/** Rust の `f64::is_sign_positive` と同じく、`-0` を負として判定する。 */
function isSignPositive(x: number): boolean {
  return x > 0 || Object.is(x, 0) || Number.isNaN(x);
}

function fractionalVec(id: FractionalId): Vec3 {
  return new Vec3(id.f, id.x, id.y);
}

/**
 * 3 点で表す三角形。
 *
 * @category Shape
 */
export class Triangle extends Shape {
  /** 三角形の 3 頂点。 */
  public readonly points: readonly [Coordinate, Coordinate, Coordinate];

  private constructor(points: readonly [Coordinate, Coordinate, Coordinate]) {
    super();
    this.points = points;
  }

  /** 3 頂点の座標から {@link Triangle} を作成する。 */
  public static create(
    points: readonly [Coordinate, Coordinate, Coordinate],
  ): Triangle {
    return new Triangle([points[0], points[1], points[2]]);
  }

  public center(): Coordinate {
    return Coordinate.centroid(this.points);
  }

  /** 面積（m²）。ECEF 上の平面として求める。 */
  public area(): number {
    const p0 = this.points[0].toVec3();
    const a = this.points[1].toVec3().sub(p0);
    const b = this.points[2].toVec3().sub(p0);
    const dot = a.dot(b);
    return Math.sqrt(a.normSquared() * b.normSquared() - dot * dot) * 0.5;
  }

  /** 3 頂点の {@link Coordinate} に分解する。 */
  public expandCoordinates(): Coordinate[] {
    return [...this.points];
  }

  /** 3 辺の {@link Line} に分解する。 */
  public expandLines(): Line[] {
    const [p0, p1, p2] = this.points;
    return [
      Line.create([p0, p1]),
      Line.create([p1, p2]),
      Line.create([p2, p0]),
    ];
  }

  /**
   * 辺 `P1→P2` を `steps` 等分した行を重ねて、小さな三角形に分ける。
   * `steps` が `0` なら空を返す。
   *
   * @internal
   */
  public divide(steps: number): Triangle[] {
    const p0 = this.points[0].toVec3();
    const p1 = this.points[1].toVec3();
    const p2 = this.points[2].toVec3();

    let prevRow: Coordinate[] = [Coordinate.fromVec3(p0)];
    const step = p2.sub(p1).scale(1.0 / steps);
    const result: Triangle[] = [];

    for (let i = 1; i <= steps; i++) {
      const start = p0.scale(1.0 - i / steps).add(p1.scale(i / steps));

      const currentRow: Coordinate[] = [];
      for (let j = 0; j <= i; j++) {
        currentRow.push(Coordinate.fromVec3(start.add(step.scale(j))));
      }

      for (let j = 0; j < i; j++) {
        result.push(
          new Triangle([
            prevRow[j] as Coordinate,
            currentRow[j] as Coordinate,
            currentRow[j + 1] as Coordinate,
          ]),
        );
        if (j > 0) {
          result.push(
            new Triangle([
              prevRow[j - 1] as Coordinate,
              prevRow[j] as Coordinate,
              currentRow[j] as Coordinate,
            ]),
          );
        }
      }
      prevRow = currentRow;
    }
    return result;
  }

  /**
   * 三角形と交わるボクセルを、外接する直方体の範囲を総当たりで調べて返す。
   * 大きな三角形では遅いので、{@link Triangle.coverSingleIds} が小さく分けてから呼ぶ。
   *
   * @internal
   */
  public singleIdsLimited(z: number): SingleId[] {
    const points = this.points.map((p) => fractionalVec(p.fractionalId(z))) as [
      Vec3,
      Vec3,
      Vec3,
    ];
    const [q0, q1, q2] = points;
    const voxels = new VoxelSet();

    const vecA = q1.sub(q0);
    const vecB = q0.sub(q2);
    const vecC = q2.sub(q1);
    const n = vecB.cross(vecA);
    const ma = n.cross(vecA);
    const mb = n.cross(vecB);
    const mc = n.cross(vecC);

    const side = 2 ** z;
    const minF = Math.floor(Math.min(q0.a, q1.a, q2.a));
    const maxF = Math.min(Math.floor(Math.max(q0.a, q1.a, q2.a)), side - 1);
    const minX = Math.floor(Math.min(q0.b, q1.b, q2.b));
    const maxX = Math.min(Math.floor(Math.max(q0.b, q1.b, q2.b)), side - 1);
    const minY = Math.floor(Math.min(q0.c, q1.c, q2.c));
    const maxY = Math.min(Math.floor(Math.max(q0.c, q1.c, q2.c)), side - 1);

    for (let f = minF; f <= maxF; f++) {
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          let signBefore = true;
          for (let i = 0; i < EIGHT_PATTERNS.length; i++) {
            const pattern = EIGHT_PATTERNS[i] as Vec3;
            const vecP = new Vec3(
              f + pattern.a - q0.a,
              x + pattern.b - q0.b,
              y + pattern.c - q0.c,
            );
            const sign = isSignPositive(n.dot(vecP));
            if (i === 0 || signBefore === sign) {
              signBefore = sign;
              continue;
            }
            // 8 頂点が平面の両側にあるなら、ボクセルと平面は交わる。
            // 頂点のどれかが三角形の 3 辺の内側にあれば、三角形とも交わる
            for (const p of EIGHT_PATTERNS) {
              const cp = new Vec3(f + p.a, x + p.b, y + p.c);
              if (
                ma.dot(cp.sub(q0)) >= 0.0 &&
                mc.dot(cp.sub(q1)) >= 0.0 &&
                mb.dot(cp.sub(q2)) >= 0.0
              ) {
                voxels.add(SingleId.create(z, f, x, y));
                break;
              }
            }
            break;
          }
        }
      }
    }
    return voxels.values();
  }

  /**
   * 三角形が覆う {@link SingleId} を返す。
   * 三角形を小さな三角形に分けてから、それぞれが交わるボクセルを求める。
   *
   * @throws {@link spatial-id!SpatialIdError} `ZOutOfRange` `z` が範囲外のとき
   */
  public coverSingleIds(z: number): SingleId[] {
    const points = this.points.map((p) => fractionalVec(p.fractionalId(z))) as [
      Vec3,
      Vec3,
      Vec3,
    ];
    const [q0, q1, q2] = points;
    const diffF =
      Math.floor(Math.max(q0.a, q1.a, q2.a)) -
      Math.floor(Math.min(q0.a, q1.a, q2.a));
    const diffX =
      Math.floor(Math.max(q0.b, q1.b, q2.b)) -
      Math.floor(Math.min(q0.b, q1.b, q2.b));
    const diffY =
      Math.floor(Math.max(q0.c, q1.c, q2.c)) -
      Math.floor(Math.min(q0.c, q1.c, q2.c));
    const steps = Math.ceil(Math.max(diffF, diffX, diffY) / 8.0);

    const seen = new VoxelSet();
    for (const tri of this.divide(steps)) {
      for (const id of tri.singleIdsLimited(z)) {
        seen.add(id);
      }
    }
    // 1 つのボクセルに収まる小さな三角形は、どのボクセルの頂点も内側に含まず、結果が空になる。
    // 頂点を含むボクセルは必ず三角形と交わるので、空のときだけそれで補う
    if (seen.size === 0) {
      for (const p of this.points) {
        seen.add(p.singleId(z));
      }
    }
    return seen.values();
  }
}
