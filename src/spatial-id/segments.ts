export interface DyadicSegment {
  zoom: number;
  index: number;
}

/**
 * `[l, r]`（両端含む、ズーム `startZoom` における非負整数のインデックス）を、
 * それを過不足なく覆う最小個数の2の冪区間（「あるズームレベルにおけるインデックス1つ」の集まり）へ
 * 分解する。F/X/Y軸（符号や周期境界の処理は呼び出し側で行う）と時間軸の両方で使う、二分木的な
 * 区間分解アルゴリズム。
 *
 * 時間軸は最大ズーム35まで扱う（`2^35`はJSのビット演算(32bit)を超える）ため、
 * シフト演算ではなく除算・剰余で二分する。
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
