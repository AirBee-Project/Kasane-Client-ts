import { SpatialIdError } from "./error";
import { type DyadicSegment, decomposeRange } from "./segments";

/** 有効なズームレベルの最大値 */
export const MAX_ZOOM = 30;

export function xyMax(z: number): number {
  return (1 << z) - 1;
}

export function fMin(z: number): number {
  return -(1 << z);
}

export function fMax(z: number): number {
  return xyMax(z);
}

export function checkZoom(z: number): void {
  if (!Number.isInteger(z) || z < 0 || z > MAX_ZOOM) {
    throw new SpatialIdError({ kind: "ZOutOfRange", z });
  }
}

export function checkF(z: number, f: number): void {
  if (!Number.isInteger(f) || f < fMin(z) || f > fMax(z)) {
    throw new SpatialIdError({ kind: "FOutOfRange", z, f });
  }
}

export function checkX(z: number, x: number): void {
  if (!Number.isInteger(x) || x < 0 || x > xyMax(z)) {
    throw new SpatialIdError({ kind: "XOutOfRange", z, x });
  }
}

export function checkY(z: number, y: number): void {
  if (!Number.isInteger(y) || y < 0 || y > xyMax(z)) {
    throw new SpatialIdError({ kind: "YOutOfRange", z, y });
  }
}

/**
 * Fインデックス範囲 `[fMin, fMax]`(ズーム `z`)を、2の冪区間(各ズームでのインデックス1つ)へ分解する。
 * Fは符号付きだが {@link decomposeRange} は非負整数の区間しか扱えないため、`2^z` を足して非負化してから
 * 分解し、各区間を分解後のズームに応じたオフセットで符号付きへ戻す。
 */
export function* decomposeF(
  z: number,
  min: number,
  max: number,
): Generator<DyadicSegment> {
  const offset = 2 ** z;
  for (const seg of decomposeRange(min + offset, max + offset, z)) {
    yield { zoom: seg.zoom, index: seg.index - 2 ** seg.zoom };
  }
}
