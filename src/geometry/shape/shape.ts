import type { SingleId } from "../../spatial-id/singleId.js";
import type { Coordinate } from "../coordinate.js";

/**
 * 現実空間の図形に共通する性質。
 *
 * @category Shape
 */
export abstract class Shape {
  /** 図形の中心を返す。 */
  public abstract center(): Coordinate;

  /**
   * 図形が覆う、ズームレベル `z` の {@link SingleId} を返す。重複はない。
   *
   * @throws {@link spatial-id!SpatialIdError} `ZOutOfRange` `z` が範囲外のとき
   * @throws {@link GeometryError} 計算の途中で座標が範囲外になったとき
   */
  public abstract coverSingleIds(z: number): SingleId[];
}

/** 空間 ID の重複を取り除くための、`f/x/y` の組を表すキー。 */
export function voxelKey(f: number, x: number, y: number): string {
  return `${f}/${x}/${y}`;
}

/** 重複する {@link SingleId} を取り除く。最初に現れた順を保つ。 */
export class VoxelSet {
  private readonly map = new Map<string, SingleId>();

  /** 追加できたら `true`、すでにあれば `false`。 */
  public add(id: SingleId): boolean {
    const key = voxelKey(id.f, id.x, id.y);
    if (this.map.has(key)) {
      return false;
    }
    this.map.set(key, id);
    return true;
  }

  public get size(): number {
    return this.map.size;
  }

  public values(): SingleId[] {
    return [...this.map.values()];
  }
}
