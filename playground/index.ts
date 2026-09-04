import { SingleId, RangeId, FlexId } from "kasane-client";

// --- SingleId ---
const single = SingleId.create(12, 0, 3638, 1614).withTime(1800, 809712);
console.log(`${single}`); // "12/0/3638/1614_1800/809712"
const restoredSingle = SingleId.parse("12/0/3638/1614_1800/809712");

// --- RangeId ---
const range = RangeId.create(4, [-3, -3], [8, 9], [5, 10]);
console.log(range.toString()); // "4/-3/8:9/5:10" （F軸は両端が等しいため自動圧縮）
const restoredRange = RangeId.parse("4/-3:6/8:9/5:10_3600/0:2");

// --- FlexId ---
const flex = FlexId.create(5, 3, 2, 3, 10, 1).withTime(25, 7);
console.log(flex.toString()); // "5/3|2/3|10/1|25/7"
const restoredFlex = FlexId.parse("5/3|2/3|10/1|25/7");
