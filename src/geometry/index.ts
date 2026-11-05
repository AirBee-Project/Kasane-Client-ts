/**
 * 座標と図形。図形が覆う空間 ID を求める。
 *
 * - 点: {@link Coordinate}（緯度・経度・高度）、{@link Ecef}（地心直交座標）、{@link FractionalId}（小数のインデックス）。
 *   どれも {@link Point} を継承し、空間 ID に変換できる。
 * - 図形: {@link Line}、{@link Triangle}、{@link Polygon}、{@link Solid}、{@link Sphere}、{@link Cylinder}、{@link Tube}。
 *   `coverSingleIds(z)` で覆う空間 ID を求める。{@link Solid} と {@link Cylinder} は `coverRangeIds(z)` も持つ。
 *
 * 距離、半径、高さなどの長さは、特に明記しない限りメートル（m）単位で扱う。
 *
 * ```ts
 * const tokyo = Coordinate.create(35.681, 139.767, 0);
 * const id = tokyo.singleId(20);
 *
 * const line = Line.create([tokyo, Coordinate.create(35.682, 139.768, 0)]);
 * const ids = line.coverSingleIds(25);
 * ```
 *
 * 範囲外の値や不正な図形は {@link GeometryError} を投げる。
 *
 * @disableGroups
 * @sortStrategy documents-first
 * @module
 */

export { Coordinate } from "./coordinate.js";
export { Ecef } from "./ecef.js";
export { Epsilon } from "./epsilon.js";
export { GeometryError, type GeometryErrorInfo } from "./error.js";
export { FractionalId } from "./fractionalId.js";
export { Point } from "./point.js";
export { Cylinder } from "./shape/cylinder.js";
export { Line } from "./shape/line.js";
export { Polygon } from "./shape/polygon.js";
export { Shape } from "./shape/shape.js";
export { Solid } from "./shape/solid.js";
export { Sphere } from "./shape/sphere.js";
export { Triangle } from "./shape/triangle.js";
export { Tube } from "./shape/tube.js";
