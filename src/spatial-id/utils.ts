import { SpatialIdError } from "./error";

/** 有効な空間ズームレベルの最大値 */
export const MAX_ZOOM = 30;

/** 時間軸のズームレベルの最大値（{@link FlexId} でのみ使用される）。 */
export const TIME_MAX_ZOOM = 35;

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

/** 時間軸のズームレベル `zoom` における1Segmentの秒数（`2^(35 - zoom)`）。 */
export function segmentSeconds(zoom: number): number {
  return 2 ** (TIME_MAX_ZOOM - zoom);
}

export function checkTZoom(zoom: number): void {
  if (!Number.isInteger(zoom) || zoom < 0 || zoom > TIME_MAX_ZOOM) {
    throw new SpatialIdError({ kind: "ZOutOfRange", z: zoom });
  }
}

export function checkTIndex(zoom: number, index: number): void {
  const maxIndex = 2 ** zoom - 1;
  if (!Number.isInteger(index) || index < 0 || index > maxIndex) {
    throw new SpatialIdError({
      kind: "TOutOfRange",
      i: segmentSeconds(zoom),
      t: index,
    });
  }
}

export interface DyadicSegment {
  zoom: number;
  index: number;
}

/**
 * セグメント木の最適配置関数
 */
export function* decomposeRange(
  l: number,
  r: number,
  startZoom: number,
): Generator<DyadicSegment> {
  let lo = l;
  let hi = r;
  let zoom = startZoom;

  while (lo <= hi) {
    if (zoom === 0) {
      yield { zoom: 0, index: lo };
      lo += 1;
      continue;
    }
    if (lo === hi) {
      yield { zoom, index: lo };
      lo += 1;
      continue;
    }
    if (lo % 2 === 1) {
      yield { zoom, index: lo };
      lo += 1;
      continue;
    }
    if (hi % 2 === 0) {
      yield { zoom, index: hi };
      hi -= 1;
      continue;
    }
    lo = Math.floor(lo / 2);
    hi = Math.floor(hi / 2);
    zoom -= 1;
  }
}

/**
 * Fインデックス範囲 `[fMin, fMax]`(ズーム `z`)を、2の冪区間へ分解する。
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

/** 単一の値、または `[min, max]` のどちらでも渡せる範囲入力。 */
export type RangeInput = number | [number, number];

export function intoRange(input: RangeInput): [number, number] {
  return Array.isArray(input) ? [input[0], input[1]] : [input, input];
}

/**
 * 次元の範囲表記文字列を出力する。
 * 両端が等しい場合は単一値（`val`）、異なる場合は `min:max` を返す。
 */
export function formatDimension(dimension: [number, number]): string {
  return dimension[0] === dimension[1]
    ? String(dimension[0])
    : `${dimension[0]}:${dimension[1]}`;
}

/**
 * 整数文字列（例: "123", "-45"）を安全にパースする。
 * 小数点、指数表記、空文字、非数字が含まれる場合は null を返す。
 */
export function parseInteger(text: string): number | null {
  if (!/^-?\d+$/.test(text)) {
    return null;
  }
  const val = Number(text);
  return Number.isSafeInteger(val) ? val : null;
}

/**
 * "start:end" または単一値の文字列を `[number, number]` へ変換する。
 * 不正な形式の場合は null を返す。
 */
export function parseDimension(text: string): [number, number] | null {
  const colonIndex = text.indexOf(":");
  if (colonIndex !== -1) {
    const startStr = text.slice(0, colonIndex);
    const endStr = text.slice(colonIndex + 1);
    if (endStr.includes(":")) {
      return null;
    }
    const start = parseInteger(startStr);
    const end = parseInteger(endStr);
    if (start === null || end === null) {
      return null;
    }
    return [start, end];
  }

  const val = parseInteger(text);
  if (val === null) {
    return null;
  }
  return [val, val];
}
