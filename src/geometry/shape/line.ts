import { SingleId } from "../../spatial-id/singleId.js";
import { ZoomLevel } from "../../spatial-id/zoomLevel.js";
import { Coordinate } from "../coordinate.js";
import { Shape } from "./shape.js";

/**
 * 2 点を結ぶ線分。
 *
 * @category Shape
 */
export class Line extends Shape {
  /** 線分の両端。 */
  public readonly points: readonly [Coordinate, Coordinate];

  private constructor(points: readonly [Coordinate, Coordinate]) {
    super();
    this.points = points;
  }

  /** 両端の座標から {@link Line} を作成する。 */
  public static create(points: readonly [Coordinate, Coordinate]): Line {
    return new Line([points[0], points[1]]);
  }

  public center(): Coordinate {
    return Coordinate.centroid(this.points);
  }

  /** 両端の {@link Coordinate} に分解する。 */
  public expandCoordinates(): Coordinate[] {
    return [...this.points];
  }

  /**
   * 線分が通る {@link SingleId} を、始点側から順に返す。
   * 線分を細かく区切り、区間ごとに 3D-DDA で通過するボクセルをたどる。
   *
   * @throws {@link spatial-id!SpatialIdError} `ZOutOfRange` `z` が範囲外のとき
   */
  public coverSingleIds(z: number): SingleId[] {
    const [a, b] = this.points;
    const vecA = a.toVec3();
    const vecB = b.toVec3();
    const distance = vecA.sub(vecB).norm();
    const v1 = a.singleId(z);
    const v2 = b.singleId(z);
    const diff =
      Math.abs(v1.f - v2.f) + Math.abs(v1.x - v2.x) + Math.abs(v1.y - v2.y);

    // Rust の `as u16` と同じく 65535 で頭打ちにする
    const divideNum = Math.min(
      5 + Math.floor(diff / 120.0 + distance / 2000.0),
      0xffff,
    );
    const coordinates: Coordinate[] = [];
    for (let i = 0; i <= divideNum; i++) {
      const t = i / divideNum;
      const v = vecA.scale(1.0 - t).add(vecB.scale(t));
      coordinates.push(Coordinate.fromVec3(v));
    }

    const voxels: SingleId[] = [];
    for (let i = 0; i + 1 < coordinates.length; i++) {
      // 区間の終点は次の区間の始点と重なるので、重複を避けて取り除く
      voxels.pop();
      for (const id of lineDda(
        z,
        coordinates[i] as Coordinate,
        coordinates[i + 1] as Coordinate,
      )) {
        voxels.push(id);
      }
    }
    return voxels;
  }

  /**
   * 折れ線が通る {@link SingleId} を返す。重複は取り除かない。
   * 点が 1 つなら、その点を含むボクセルだけを返す。
   *
   * @throws {@link spatial-id!SpatialIdError} `ZOutOfRange` `z` が範囲外のとき
   * @internal
   */
  public static coverPolyline(
    coordinates: readonly Coordinate[],
    z: number,
  ): SingleId[] {
    if (coordinates.length === 1) {
      return [(coordinates[0] as Coordinate).singleId(z)];
    }
    const ids: SingleId[] = [];
    for (let i = 0; i + 1 < coordinates.length; i++) {
      ids.push(
        ...Line.create([
          coordinates[i] as Coordinate,
          coordinates[i + 1] as Coordinate,
        ]).coverSingleIds(z),
      );
    }
    return ids;
  }
}

/** Rust の `f64::signum` と同じく、`-0` を負として符号を返す。 */
function signum(x: number): number {
  return x < 0 || Object.is(x, -0) ? -1 : 1;
}

/** `a` から `b` までを結ぶ線分が通るボクセルを、3D-DDA でたどる。 */
function lineDda(z: number, a: Coordinate, b: Coordinate): SingleId[] {
  ZoomLevel.create(z);
  const origin1 = a.toIndex(z);
  const origin2 = b.toIndex(z);

  // 大きな値同士の引き算で精度が落ちないよう、始点の整数部分を原点に取り直す
  const offsets = origin1.map(Math.floor) as [number, number, number];
  const vp1 = origin1.map((v, i) => v - (offsets[i] as number)) as [
    number,
    number,
    number,
  ];
  const vp2 = origin2.map((v, i) => v - (offsets[i] as number)) as [
    number,
    number,
    number,
  ];
  const dTotal = [
    Math.abs(vp2[0] - vp1[0]),
    Math.abs(vp2[1] - vp1[1]),
    Math.abs(vp2[2] - vp1[2]),
  ] as const;

  // 変化量が最大の軸を主軸にして、他の 2 軸との比で壁を越える時刻を求める
  const maxD = Math.max(dTotal[0], dTotal[1], dTotal[2]);
  const maxFlag = maxD === dTotal[0] ? 0 : maxD === dTotal[1] ? 1 : 2;
  const otherFlag1 = (maxFlag + 1) % 3;
  const otherFlag2 = (maxFlag + 2) % 3;

  const i1 = Math.floor(vp1[maxFlag] as number);
  const j1 = Math.floor(vp1[otherFlag1] as number);
  const k1 = Math.floor(vp1[otherFlag2] as number);
  const i2 = Math.floor(vp2[maxFlag] as number);
  const j2 = Math.floor(vp2[otherFlag1] as number);
  const k2 = Math.floor(vp2[otherFlag2] as number);

  const dO1 =
    vp2[otherFlag1] !== vp1[otherFlag1]
      ? (dTotal[maxFlag] as number) / (dTotal[otherFlag1] as number)
      : Number.POSITIVE_INFINITY;
  const dO2 =
    vp2[otherFlag2] !== vp1[otherFlag2]
      ? (dTotal[maxFlag] as number) / (dTotal[otherFlag2] as number)
      : Number.POSITIVE_INFINITY;

  const vm = vp1[maxFlag] as number;
  const tm =
    i2 > i1
      ? 1.0 - vm + Math.floor(vm)
      : i2 === i1
        ? Number.POSITIVE_INFINITY
        : vm - Math.floor(vm);

  const v1 = vp1[otherFlag1] as number;
  let to1 =
    j2 > j1
      ? (1.0 - v1 + Math.floor(v1)) * dO1 - tm
      : j2 === j1
        ? Number.POSITIVE_INFINITY
        : (v1 - Math.floor(v1)) * dO1 - tm;

  const v2 = vp1[otherFlag2] as number;
  let to2 =
    k2 > k1
      ? (1.0 - v2 + Math.floor(v2)) * dO2 - tm
      : k2 === k1
        ? Number.POSITIVE_INFINITY
        : (v2 - Math.floor(v2)) * dO2 - tm;

  const maxSteps = Math.abs(i2 - i1) + Math.abs(j2 - j1) + Math.abs(k2 - k1);

  // 主軸を先頭に並べ替えた添字を、[f, x, y] の順に戻すための対応
  const pull = [
    (3 - maxFlag) % 3,
    (3 - otherFlag2) % 3,
    (3 - otherFlag1) % 3,
  ] as const;

  const current = [i1, j1, k1];
  const signI = signum((vp2[maxFlag] as number) - vm);
  const signJ = signum((vp2[otherFlag1] as number) - v1);
  const signK = signum((vp2[otherFlag2] as number) - v2);
  let tmInt = 0;

  const at = (): SingleId =>
    SingleId.create(
      z,
      (current[pull[0]] as number) + (offsets[0] as number),
      (current[pull[1]] as number) + (offsets[1] as number),
      (current[pull[2]] as number) + (offsets[2] as number),
    );

  const ids = [at()];
  for (let step = 0; step < maxSteps; step++) {
    const minWall = Math.min(tmInt, to1, to2);
    if (minWall === tmInt) {
      tmInt += 1;
      current[0] = (current[0] as number) + signI;
    } else if (minWall === to1) {
      to1 += dO1;
      current[1] = (current[1] as number) + signJ;
    } else {
      to2 += dO2;
      current[2] = (current[2] as number) + signK;
    }
    ids.push(at());
  }
  return ids;
}
