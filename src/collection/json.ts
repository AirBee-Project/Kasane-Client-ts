/**
 * 時空間データの JSON（スキーマ v1.0）。
 *
 * @see https://airbee-project.github.io/schemas/json/v1.0.json
 */
export type SpatialIdJson = {
  /** データ全体のメタ情報。 */
  meta: SpatialIdJsonMeta;
  /** 独自のメタデータなど、任意の構造のデータ。 */
  option?: Record<string, unknown> | undefined;
  /** 名前付きのデータの一覧。 */
  data: SpatialIdJsonData[];
};

/** {@link SpatialIdJson} のメタ情報。 */
export type SpatialIdJsonMeta = {
  /** スキーマのバージョン。 */
  version: string;
  /** データの説明文。 */
  description?: string | undefined;
};

/** {@link SpatialIdJson} の名前付きのデータ。 */
export type SpatialIdJsonData = {
  /** データの名前。 */
  name: string;
  /** 時空間 ID に対応づける値。各 ID の {@link SpatialIdJsonId.ref} から添字で参照する。 */
  value?: SpatialIdJsonValue | undefined;
  /** データが占める時空間 ID。 */
  ids: SpatialIdJsonId[];
};

/** {@link SpatialIdJsonData.value} の配列。要素はすべて同じ型にする。 */
export type SpatialIdJsonValue =
  | string[]
  | number[]
  | boolean[]
  | Record<string, unknown>[];

/**
 * 1 つの値（`[value]`）か、両端を含む範囲（`[start, end]`）。
 */
export type SpatialIdJsonRange = [number] | [number, number];

/**
 * {@link SpatialIdJson} の時空間 ID。
 *
 * `z` 以外の次元は、省略するとその次元のすべての値を表す。
 */
export type SpatialIdJsonId = {
  /** ズームレベル。0 以上の整数。 */
  z: number;
  /** 高さ方向のインデックス。範囲は `start <= end`。 */
  f?: SpatialIdJsonRange | undefined;
  /** 東西方向のインデックス。`start` と `end` の順で、地球を回り込む向きが決まる。 */
  x?: SpatialIdJsonRange | undefined;
  /** 南北方向のインデックス。範囲は `start <= end`。 */
  y?: SpatialIdJsonRange | undefined;
  /** 時間間隔。0 以上の整数。省略するとすべての時間で有効。 */
  i?: number | undefined;
  /** 時間インデックス。範囲は `start <= end`。 */
  t?: SpatialIdJsonRange | undefined;
  /** {@link SpatialIdJsonData.value} の添字。0 以上の整数。 */
  ref?: number | undefined;
};
