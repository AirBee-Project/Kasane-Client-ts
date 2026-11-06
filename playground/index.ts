import { SpatialIdSet } from "@airbee-project/kasane-client/collection";
import { SingleId } from "@airbee-project/kasane-client/spatial-id";

let set=SpatialIdSet.create();


let sample_id=SingleId.create(3, 4, 5, 6);

set.insert(sample_id);

for (const element of set) {
  console.log(element.toString())
}