/**
 * 緯度・経度・高度の座標。
 *
 * {@link Coordinate} から、その座標を含む空間 ID を求められる。
 *
 * ```ts
 * const tokyo = Coordinate.create(35.681, 139.767, 0);
 * const id = tokyo.toSingleId(20);
 * ```
 *
 * 緯度・経度・高度が範囲外のときは {@link GeometryError} を投げる。
 *
 * @disableGroups
 * @sortStrategy documents-first
 * @module
 */

export { Coordinate, type CoordinateRange } from "./coordinate.js";
export { GeometryError, type GeometryErrorInfo } from "./error.js";
