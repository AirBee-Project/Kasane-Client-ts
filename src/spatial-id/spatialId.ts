import type { FlexId } from "./flexId.js";
import type { RangeId } from "./rangeId.js";
import type { SingleId } from "./singleId.js";

/** API に渡せる時空間 ID。{@link SingleId}、{@link RangeId}、{@link FlexId} のどれか。 */
export type SpatialId = SingleId | RangeId | FlexId;
