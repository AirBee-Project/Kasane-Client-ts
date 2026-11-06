import { describe, expect, it } from "vitest";
import { FlexId } from "../../spatial-id/flexId.js";
import { Interval } from "../../spatial-id/interval.js";
import { RangeId } from "../../spatial-id/rangeId.js";
import { SingleId } from "../../spatial-id/singleId.js";
import type { SpatialId } from "../../spatial-id/spatialId.js";
import { SpatialIdSet } from "../spatialIdSet.js";

/** 分け方によらず比べられるよう、SingleId の文字列に展開して並べる。 */
function singles(ids: Iterable<SpatialId>): string[] {
  return [...ids].flatMap((id) => [...id.singleIds()].map(String)).sort();
}

describe("SpatialIdSet の挿入と for...of", () => {
  it("SingleId を1つ挿入すると、その ID だけを返す", () => {
    const id = SingleId.create(3, 3, 3, 3);
    const set = new SpatialIdSet([id]);
    expect(singles(set)).toEqual([id.toString()]);
    expect(set.count()).toBe(1);
  });

  it("RangeId を挿入すると、同じ範囲を返す", () => {
    const range = RangeId.create(4, [-4, 5], [2, 10], 3);
    expect(singles(new SpatialIdSet([range]))).toEqual(singles([range]));
  });

  it("全空間の上下を挿入できる", () => {
    const range = RangeId.create(0, [-1, 0], 0, 0);
    expect(singles(new SpatialIdSet([range]))).toEqual(["0/-1/0/0", "0/0/0/0"]);
  });

  it("経度の周期境界をまたぐ RangeId を挿入できる", () => {
    const range = RangeId.create(2, 0, [3, 0], 0);
    expect(singles(new SpatialIdSet([range]))).toEqual(["2/0/0/0", "2/0/3/0"]);
  });

  it("FlexId を挿入できる", () => {
    const flex = FlexId.create(5, 3, 2, 3, 10, 1);
    expect(singles(new SpatialIdSet([flex]))).toEqual(singles([flex]));
  });

  it("2の冪秒の時間は、そのままの形で返す", () => {
    const id = SingleId.create(4, 3, 2, 1).timeWith(1024, 7);
    expect([...new SpatialIdSet([id])].map(String)).toEqual(["4/3/2/1_1024/7"]);
  });

  it("2の冪でない時間は分けて持ち、合わせると元の時間になる", () => {
    const id = SingleId.create(4, 3, 2, 1).timeWith(Interval.HOUR, 5);
    const ranges = [...new SpatialIdSet([id])].map((r) => r.timeRange());
    const total = ranges.reduce((sum, [start, end]) => sum + end - start, 0);
    expect(total).toBe(3600);
    expect(Math.min(...ranges.map(([start]) => start))).toBe(5 * 3600);
    expect(Math.max(...ranges.map(([, end]) => end))).toBe(6 * 3600);
  });

  it("同じ ID を2回挿入しても二重には持たない", () => {
    const id = SingleId.create(4, 3, 2, 1);
    const set = new SpatialIdSet([id, id]);
    expect(set.count()).toBe(1);
  });
});

describe("SpatialIdSet の取得と削除", () => {
  it("get は重なる部分を切り取って返す", () => {
    const set = new SpatialIdSet([RangeId.create(4, 3, [2, 3], 1)]);
    expect(set.get(SingleId.create(4, 3, 3, 1)).map(String)).toEqual([
      "4/3/3/1",
    ]);
    expect(set.get(SingleId.create(4, 3, 4, 1))).toEqual([]);
  });

  it("remove は重なる部分を取り除いて返す", () => {
    const set = new SpatialIdSet([RangeId.create(4, 3, [2, 3], 1)]);
    expect(singles(set.remove(SingleId.create(4, 3, 3, 1)))).toEqual([
      "4/3/3/1",
    ]);
    expect(singles(set)).toEqual(["4/3/2/1"]);
  });

  it("clear で空になる", () => {
    const set = new SpatialIdSet([SingleId.create(4, 3, 2, 1)]);
    expect(set.isEmpty()).toBe(false);
    set.clear();
    expect(set.isEmpty()).toBe(true);
    expect([...set]).toEqual([]);
  });
});

describe("SpatialIdSet の FlexId で返すメソッド", () => {
  const flex = FlexId.create(5, 3, 2, 3, 10, 1);

  it("挿入した FlexId をそのまま返す", () => {
    const set = new SpatialIdSet([flex]);
    const ids = [...set.iterFlexIds()];
    expect(ids).toHaveLength(1);
    expect(ids[0]?.equals(flex)).toBe(true);
  });

  it("getFlexIds は重なる部分を FlexId で返す", () => {
    const set = new SpatialIdSet([flex]);
    const [id] = set.getFlexIds(flex);
    expect(id?.equals(flex)).toBe(true);
  });

  it("時間を持つ FlexId も返せる", () => {
    const id = SingleId.create(4, 3, 2, 1).timeWith(1024, 7);
    const [got] = [...new SpatialIdSet([id]).iterFlexIds()];
    expect(got?.toString()).toBe("4/3|4/2|4/1|25/7");
  });

  it("removeFlexIds は取り除いた部分を FlexId で返す", () => {
    const set = new SpatialIdSet([RangeId.create(4, 3, [2, 3], 1)]);
    const removed = set.removeFlexIds(SingleId.create(4, 3, 3, 1));
    expect(removed.map(String)).toEqual(["4/3|4/3|4/1"]);
    expect(singles(set)).toEqual(["4/3/2/1"]);
  });
});

describe("SpatialIdSet の集合演算", () => {
  const lhs = new SpatialIdSet([
    SingleId.create(4, 3, 2, 1),
    SingleId.create(4, 3, 2, 2),
  ]);
  const rhs = new SpatialIdSet([
    SingleId.create(4, 3, 2, 2),
    SingleId.create(4, 4, 4, 4),
  ]);

  it("和集合", () => {
    expect(singles(lhs.union(rhs))).toEqual(["4/3/2/1", "4/3/2/2", "4/4/4/4"]);
  });

  it("積集合", () => {
    expect(singles(lhs.intersection(rhs))).toEqual(["4/3/2/2"]);
  });

  it("差集合は向きで結果が変わる", () => {
    expect(singles(lhs.difference(rhs))).toEqual(["4/3/2/1"]);
    expect(singles(rhs.difference(lhs))).toEqual(["4/4/4/4"]);
  });

  it("演算しても元の集合は変わらない", () => {
    lhs.union(rhs);
    expect(singles(lhs)).toEqual(["4/3/2/1", "4/3/2/2"]);
  });
});

describe("SpatialIdSet の解放", () => {
  it("2回解放してもよい", () => {
    const set = new SpatialIdSet();
    set[Symbol.dispose]();
    expect(() => set[Symbol.dispose]()).not.toThrow();
  });

  it("解放したあとに使うと例外を投げる", () => {
    const set = new SpatialIdSet();
    set[Symbol.dispose]();
    expect(() => set.count()).toThrow();
  });

  it("using で解放できる", () => {
    let outer: SpatialIdSet | undefined;
    {
      using set = new SpatialIdSet();
      outer = set;
    }
    expect(() => outer.count()).toThrow();
  });

  it("解放した集合を演算に渡すと例外を投げ、呼び出し元はそのまま使える", () => {
    const set = new SpatialIdSet([SingleId.create(4, 3, 2, 1)]);
    const freed = new SpatialIdSet();
    freed[Symbol.dispose]();
    expect(() => set.union(freed)).toThrow();
    expect(() => set.intersection(freed)).toThrow();
    expect(() => set.difference(freed)).toThrow();
    set.insert(SingleId.create(4, 3, 2, 2));
    expect(singles(set)).toEqual(["4/3/2/1", "4/3/2/2"]);
    expect(() => set[Symbol.dispose]()).not.toThrow();
  });
});

describe("SpatialIdSet.create", () => {
  it("new と同じ集合を作る", () => {
    const ids = [SingleId.create(4, 3, 2, 1), RangeId.create(4, 3, [2, 3], 2)];
    expect(singles(SpatialIdSet.create(ids))).toEqual(
      singles(new SpatialIdSet(ids)),
    );
    expect(SpatialIdSet.create().isEmpty()).toBe(true);
  });
});
