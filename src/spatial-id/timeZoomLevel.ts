import { SpatialIdError } from "./error";

/** 時間軸のズームレベルの最大値（{@link FlexId} でのみ使用される）。 */
export const TIME_MAX_ZOOM = 35;

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
