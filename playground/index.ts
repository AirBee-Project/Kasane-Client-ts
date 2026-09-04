import { FlexId, RangeId, SingleId } from "../src/index";

// --- SingleId ---
const single = SingleId.create(12, 0, 3638, 1614).withTime(1800, 809712);
console.log(`${single}`); // "12/0/3638/1614_1800/809712"
const restoredSingle = SingleId.parse("12/0/3638/1614_1800/809712");
console.log("Restored Single:", restoredSingle.toString());

// --- RangeId ---
const range = RangeId.create(4, [-3, -3], [8, 9], [5, 10]);
console.log(range.toString()); // "4/-3/8:9/5:10"
const restoredRange = RangeId.parse("4/-3/8:9/5:10");
console.log("Restored Range:", restoredRange.toString());

// --- FlexId ---
const flex = FlexId.create(5, 3, 2, 3, 10, 1).withTime(25, 7);
console.log(flex.toString()); // "5/3|2/3|10/1|25/7"
const restoredFlex = FlexId.parse("5/3|2/3|10/1|25/7");
console.log("Restored Flex:", restoredFlex.toString());
