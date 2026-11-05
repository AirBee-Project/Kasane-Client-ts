/// <reference types="node" />
import { writeFileSync } from "node:fs";
import { Coordinate, Triangle } from "@airbee-project/kasane-client/geometry";

const triangle = Triangle.create([
  Coordinate.create(35.681, 139.766, 10),
  Coordinate.create(35.682, 139.766, 100),
  Coordinate.create(35.681, 139.767, 15),
]);

const ids = triangle.coverSingleIds(25);

writeFileSync("playground/ids.txt", ids.join(","));
console.log(`${ids.length} 件を playground/ids.txt に書き込みました`);
