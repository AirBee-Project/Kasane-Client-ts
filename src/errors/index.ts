/**
 * 空間 ID と座標の検証で投げるエラー。
 *
 * 検証に失敗すると {@link SpatialIdError} / {@link GeometryError} を投げる。
 * どちらも `info.kind` で種類を判別できる。
 *
 * ```ts
 * try {
 *   SingleId.create(31, 0, 0, 0);
 * } catch (e) {
 *   if (e instanceof SpatialIdError && e.info.kind === "ZOutOfRange") {
 *     console.log(e.info.z); // 31
 *   }
 * }
 * ```
 *
 * @disableGroups
 * @sortStrategy documents-first
 * @module
 */

// biome-ignore assist/source/organizeImports: @sortStrategy documents-first はドキュメント以外を並べ替えないので、docs はこの export の順に並ぶ
export { SpatialIdError, type SpatialIdErrorInfo } from "./spatialId.js";
export { GeometryError, type GeometryErrorInfo } from "./geometry.js";
