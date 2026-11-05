import { RangeId } from "../../spatial-id/rangeId.js";
import { SingleId } from "../../spatial-id/singleId.js";
import { ZoomLevel } from "../../spatial-id/zoomLevel.js";
import { Coordinate } from "../coordinate.js";
import type { Ecef } from "../ecef.js";
import { Epsilon } from "../epsilon.js";
import { GeometryError } from "../error.js";
import type { Line } from "./line.js";
import type { Polygon } from "./polygon.js";
import { Shape, VoxelSet, voxelKey } from "./shape.js";
import type { Triangle } from "./triangle.js";

type Voxel = readonly [number, number, number];

const DIRECTIONS: readonly Voxel[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

/**
 * 閉じた面で囲まれた立体。{@link Polygon} の集まりで表す。
 *
 * 面の辺がすべて偶数回現れる（隙間なく閉じている）ことを、作成時に検証する。
 *
 * @category Shape
 */
export class Solid extends Shape {
  private readonly _polygons: readonly Polygon[];

  private constructor(polygons: readonly Polygon[]) {
    super();
    this._polygons = polygons;
  }

  /**
   * 面の集まりから {@link Solid} を作成する。頂点を持たない面は取り除く。
   * 辺の一致は、ECEF 座標を `epsilon` 刻みに丸めて判定する。
   *
   * @throws {@link GeometryError} `SolidNotWatertight` 有効な面がない、または閉じていないとき
   */
  public static create(
    polygons: readonly Polygon[],
    epsilon: Epsilon = Epsilon.DEFAULT,
  ): Solid {
    const filtered = polygons.filter((p) => p.vertices.length > 0);

    if (filtered.length === 0) {
      throw new GeometryError({
        kind: "SolidNotWatertight",
        openEdgeCount: 0,
      });
    }

    const openEdges = Solid.countOpenEdges(filtered, epsilon);
    if (openEdges > 0) {
      throw new GeometryError({
        kind: "SolidNotWatertight",
        openEdgeCount: openEdges,
      });
    }
    return new Solid(filtered);
  }

  /** 面を構成する {@link Polygon}。 */
  public get polygons(): readonly Polygon[] {
    return this._polygons;
  }

  public center(): Coordinate {
    return Coordinate.centroid(this.expandCoordinates());
  }

  /** 全面の頂点を {@link Coordinate} に分解する。 */
  public expandCoordinates(): Coordinate[] {
    return this._polygons.flatMap((p) => p.expandCoordinates());
  }

  /** 全面を三角形分割したときの、各三角形の辺を {@link Line} で返す。 */
  public expandLines(): Line[] {
    return this._polygons.flatMap((p) => p.expandLines());
  }

  /** 全面を {@link Triangle} に分割する。 */
  public expandTriangles(): Triangle[] {
    return this._polygons.flatMap((p) => p.expandTriangles());
  }

  /** 面の {@link Polygon} を返す。 */
  public expandPolygons(): Polygon[] {
    return [...this._polygons];
  }

  /**
   * 立体が覆う {@link SingleId} を返す。内部も含む。
   *
   * 表面のボクセルを求め、外接する直方体の外側から塗りつぶした残りを内部とみなす。
   *
   * @throws {@link spatial-id!SpatialIdError} `ZOutOfRange` `z` が範囲外のとき
   */
  public coverSingleIds(z: number): SingleId[] {
    const zoom = ZoomLevel.create(z);
    const surface = this.surfaceSingleIds(z);
    if (surface.length === 0) {
      return [];
    }

    const surfaceKeys = new Set(surface.map((s) => voxelKey(s.f, s.x, s.y)));
    const box = boundingBox(surface);

    const cuboid = new Map<string, Voxel>();
    const openList: Voxel[] = [];
    for (let f = box.minF; f <= box.maxF; f++) {
      for (let x = box.minX; x <= box.maxX; x++) {
        for (let y = box.minY; y <= box.maxY; y++) {
          const key = voxelKey(f, x, y);
          const isBoundary =
            f === box.minF ||
            f === box.maxF ||
            x === box.minX ||
            x === box.maxX ||
            y === box.minY ||
            y === box.maxY;
          if (isBoundary && !surfaceKeys.has(key)) {
            openList.push([f, x, y]);
          } else {
            cuboid.set(key, [f, x, y]);
          }
        }
      }
    }

    for (let head = 0; head < openList.length; head++) {
      const [f, x, y] = openList[head] as Voxel;
      for (const direction of DIRECTIONS) {
        const next = neighbor(zoom, f, x, y, direction);
        if (next === null) {
          continue;
        }
        const key = voxelKey(next[0], next[1], next[2]);
        if (cuboid.has(key) && !surfaceKeys.has(key)) {
          cuboid.delete(key);
          openList.push(next);
        }
      }
    }

    return [...cuboid.values()].map(([f, x, y]) => SingleId.create(z, f, x, y));
  }

  /**
   * 立体が覆う範囲を、F 方向に連続する {@link RangeId} で返す。内部も含む。
   * {@link Solid.coverSingleIds} と同じ範囲を、より少ない件数で表す。
   *
   * @throws {@link spatial-id!SpatialIdError} `ZOutOfRange` `z` が範囲外のとき
   */
  public coverRangeIds(z: number): RangeId[] {
    const zoom = ZoomLevel.create(z);
    const surface = this.surfaceSingleIds(z);
    if (surface.length === 0) {
      return [];
    }

    const surfaceKeys = new Set(surface.map((s) => voxelKey(s.f, s.x, s.y)));
    const { minF, maxF, minX, maxX, minY, maxY } = boundingBox(surface);

    const outside = new Set<string>();
    const openList: Voxel[] = [];
    const seedOutside = (f: number, x: number, y: number): void => {
      const key = voxelKey(f, x, y);
      if (!surfaceKeys.has(key) && !outside.has(key)) {
        outside.add(key);
        openList.push([f, x, y]);
      }
    };

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        seedOutside(minF, x, y);
        if (maxF !== minF) seedOutside(maxF, x, y);
      }
    }
    for (let f = minF; f <= maxF; f++) {
      for (let y = minY; y <= maxY; y++) {
        seedOutside(f, minX, y);
        if (maxX !== minX) seedOutside(f, maxX, y);
      }
    }
    for (let f = minF; f <= maxF; f++) {
      for (let x = minX; x <= maxX; x++) {
        seedOutside(f, x, minY);
        if (maxY !== minY) seedOutside(f, x, maxY);
      }
    }

    for (let head = 0; head < openList.length; head++) {
      const [f, x, y] = openList[head] as Voxel;
      for (const direction of DIRECTIONS) {
        const next = neighbor(zoom, f, x, y, direction);
        if (next === null) {
          continue;
        }
        const [nf, nx, ny] = next;
        if (
          nf >= minF &&
          nf <= maxF &&
          nx >= minX &&
          nx <= maxX &&
          ny >= minY &&
          ny <= maxY
        ) {
          const key = voxelKey(nf, nx, ny);
          if (!surfaceKeys.has(key) && !outside.has(key)) {
            outside.add(key);
            openList.push(next);
          }
        }
      }
    }

    // 列（x, y）ごとに F 方向へ走査して、内部が続く区間を RangeId にする
    const results: RangeId[] = [];
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        let start: number | null = null;
        for (let f = minF; f <= maxF; f++) {
          const isInside = !outside.has(voxelKey(f, x, y));
          if (isInside && start === null) {
            start = f;
          } else if (!isInside && start !== null) {
            results.push(RangeId.create(z, [start, f - 1], [x, x], [y, y]));
            start = null;
          }
        }
        if (start !== null) {
          results.push(RangeId.create(z, [start, maxF], [x, x], [y, y]));
        }
      }
    }
    return results;
  }

  /** 全面の三角形が覆うボクセルを集める。 */
  private surfaceSingleIds(z: number): SingleId[] {
    const unique = new VoxelSet();
    for (const polygon of this._polygons) {
      for (const id of polygon.coverSingleIds(z)) {
        unique.add(id);
      }
    }
    return unique.values();
  }

  /** 奇数回しか現れない辺の数を数える。 */
  private static countOpenEdges(
    polygons: readonly Polygon[],
    epsilon: Epsilon,
  ): number {
    const edgeCounts = new Map<string, number>();
    const precision = epsilon.asMeters();

    for (const polygon of polygons) {
      const vertices = polygon.vertices;
      const len = vertices.length;
      if (len < 3) {
        continue;
      }

      for (let i = 0; i < len; i++) {
        const q1 = quantize((vertices[i] as Coordinate).toEcef(), precision);
        const q2 = quantize(
          (vertices[(i + 1) % len] as Coordinate).toEcef(),
          precision,
        );

        // 縮退した辺は無視する
        if (q1 === q2) {
          continue;
        }
        // 向きによらず同じ辺として数えるため、辞書順で小さい方を先にする
        const key = q1 < q2 ? `${q1}|${q2}` : `${q2}|${q1}`;
        edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
      }
    }

    let open = 0;
    for (const count of edgeCounts.values()) {
      if (count % 2 !== 0) {
        open += 1;
      }
    }
    return open;
  }
}

/** ECEF 座標を `precision` 刻みの整数に丸め、キーにする。`0` なら値そのもの。 */
function quantize(e: Ecef, precision: number): string {
  if (precision === 0) {
    // `-0` と `0` を同じキーにそろえる
    return `${e.x + 0},${e.y + 0},${e.z + 0}`;
  }
  return `${roundHalfAwayFromZero(e.x / precision)},${roundHalfAwayFromZero(e.y / precision)},${roundHalfAwayFromZero(e.z / precision)}`;
}

/** Rust の `round` と同じく、`.5` を 0 から遠い側へ丸める。 */
function roundHalfAwayFromZero(x: number): number {
  return Math.sign(x) * Math.round(Math.abs(x)) + 0;
}

function boundingBox(ids: readonly SingleId[]) {
  const first = ids[0] as SingleId;
  const box = {
    minF: first.f,
    maxF: first.f,
    minX: first.x,
    maxX: first.x,
    minY: first.y,
    maxY: first.y,
  };
  for (const s of ids) {
    box.minF = Math.min(box.minF, s.f);
    box.maxF = Math.max(box.maxF, s.f);
    box.minX = Math.min(box.minX, s.x);
    box.maxX = Math.max(box.maxX, s.x);
    box.minY = Math.min(box.minY, s.y);
    box.maxY = Math.max(box.maxY, s.y);
  }
  return box;
}

/**
 * 1 つ隣のボクセルを返す。F と Y は範囲外なら `null`、X は経度方向に循環する。
 */
function neighbor(
  zoom: ZoomLevel,
  f: number,
  x: number,
  y: number,
  [df, dx, dy]: Voxel,
): Voxel | null {
  if (df !== 0) {
    const nf = f + df;
    return nf < zoom.fMin() || nf > zoom.fMax() ? null : [nf, x, y];
  }
  if (dx !== 0) {
    const n = zoom.xyMax() + 1;
    return [f, (((x + dx) % n) + n) % n, y];
  }
  const ny = y + dy;
  return ny < 0 || ny > zoom.xyMax() ? null : [f, x, ny];
}
