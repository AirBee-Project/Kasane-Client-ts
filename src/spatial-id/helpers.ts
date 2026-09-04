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
