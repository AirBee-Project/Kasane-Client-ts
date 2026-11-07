import { SpatialIdMap } from "@airbee-project/kasane-client/collection";
import { RangeId } from "@airbee-project/kasane-client/spatial-id";

let map:SpatialIdMap<number>=SpatialIdMap.create()

let id=RangeId.create(10, [10,11], 1, 3);

map.insert(id, 10)