import { describe, expect, it } from "vitest";
import { FlexId } from "../../spatial-id/flexId.js";
import { RangeId } from "../../spatial-id/rangeId.js";
import { SingleId } from "../../spatial-id/singleId.js";
import { SpatialIdMap } from "../spatialIdMap.js";

const first = SingleId.create(4, 3, 2, 1);
const second = SingleId.create(4, 3, 2, 2);

/** 分け方によらず比べられるよう、SingleId の文字列と値の組に展開して並べる。 */
function singles<V>(entries: Iterable<[RangeId, V]>): [string, V][] {
  return [...entries]
    .flatMap(([id, value]) =>
      [...id.singleIds()].map((s): [string, V] => [s.toString(), value]),
    )
    .sort(([a], [b]) => a.localeCompare(b));
}

describe("SpatialIdMap の挿入と取得", () => {
  it("同じ場所に挿入すると値を上書きする", () => {
    const map = new SpatialIdMap<number>();
    map.insert(first, 10);
    map.insert(first, 20);
    expect(singles(map.get(first))).toEqual([["4/3/2/1", 20]]);
    expect(singles(map)).toEqual([["4/3/2/1", 20]]);
  });

  it("get は重なる部分を切り取って値と返す", () => {
    const map = new SpatialIdMap([[RangeId.create(4, 3, [2, 3], 1), "a"]]);
    expect(singles(map.get(SingleId.create(4, 3, 3, 1)))).toEqual([
      ["4/3/3/1", "a"],
    ]);
    expect(map.get(SingleId.create(4, 3, 4, 1))).toEqual([]);
  });

  it("オブジェクトの値は同じ参照で返す", () => {
    const value = { name: "a" };
    const map = new SpatialIdMap([[first, value]]);
    const [entry] = map.get(first);
    expect(entry?.[1]).toBe(value);
  });

  it("remove は重なる部分を取り除いて値と返す", () => {
    const map = new SpatialIdMap([
      [first, 10],
      [second, 20],
    ]);
    expect(singles(map.remove(first))).toEqual([["4/3/2/1", 10]]);
    expect(map.get(first)).toEqual([]);
    expect(singles(map)).toEqual([["4/3/2/2", 20]]);
    expect(map.count()).toBe([...map].length);
  });

  it("clear で空になる", () => {
    const map = new SpatialIdMap([[first, 10]]);
    expect(map.isEmpty()).toBe(false);
    map.clear();
    expect(map.isEmpty()).toBe(true);
  });
});

describe("SpatialIdMap の FlexId で返すメソッド", () => {
  const flex = FlexId.create(5, 3, 2, 3, 10, 1);

  it("挿入した FlexId と値をそのまま返す", () => {
    const map = new SpatialIdMap([[flex, "a"]]);
    const entries = [...map.iterFlexIds()];
    expect(entries).toHaveLength(1);
    expect(entries[0]?.[0].equals(flex)).toBe(true);
    expect(entries[0]?.[1]).toBe("a");
  });

  it("getFlexIds は重なる部分を FlexId と値で返す", () => {
    const map = new SpatialIdMap([[RangeId.create(4, 3, [2, 3], 1), 10]]);
    expect(
      map
        .getFlexIds(SingleId.create(4, 3, 3, 1))
        .map(([id, v]) => [id.toString(), v]),
    ).toEqual([["4/3|4/3|4/1", 10]]);
  });

  it("removeFlexIds は取り除いた部分を FlexId と値で返す", () => {
    const map = new SpatialIdMap([
      [first, 10],
      [second, 20],
    ]);
    expect(
      map.removeFlexIds(first).map(([id, v]) => [id.toString(), v]),
    ).toEqual([["4/3|4/2|4/1", 10]]);
    expect(singles(map)).toEqual([["4/3/2/2", 20]]);
  });
});

describe("SpatialIdMap の演算", () => {
  const lhs = new SpatialIdMap([[first, 1]]);
  const rhs = new SpatialIdMap([
    [first, "x"],
    [second, "y"],
  ]);

  it("和は、両方に値がある場所でこのマップの値を使う", () => {
    expect(singles(lhs.union(rhs))).toEqual([
      ["4/3/2/1", 1],
      ["4/3/2/2", "y"],
    ]);
  });

  it("積は、両方に値がある場所だけをこのマップの値で残す", () => {
    expect(singles(rhs.intersection(lhs))).toEqual([["4/3/2/1", "x"]]);
  });

  it("差は、相手に値がある場所を取り除く", () => {
    expect(singles(rhs.difference(lhs))).toEqual([["4/3/2/2", "y"]]);
  });
});

describe("SpatialIdMap の解放", () => {
  it("2回解放してもよい", () => {
    const map = new SpatialIdMap();
    map[Symbol.dispose]();
    expect(() => map[Symbol.dispose]()).not.toThrow();
  });

  it("using で解放できる", () => {
    let outer: SpatialIdMap<number> | undefined;
    {
      using map = new SpatialIdMap<number>();
      outer = map;
    }
    expect(() => outer.count()).toThrow();
  });

  it("解放したマップを演算に渡すと例外を投げ、呼び出し元はそのまま使える", () => {
    const map = new SpatialIdMap([[SingleId.create(4, 3, 2, 1), "x"]]);
    const freed = new SpatialIdMap();
    freed[Symbol.dispose]();
    expect(() => map.union(freed)).toThrow();
    expect(() => map.intersection(freed)).toThrow();
    expect(() => map.difference(freed)).toThrow();
    map.insert(SingleId.create(4, 3, 2, 2), "y");
    expect(singles(map)).toEqual([
      ["4/3/2/1", "x"],
      ["4/3/2/2", "y"],
    ]);
    expect(() => map[Symbol.dispose]()).not.toThrow();
  });
});

describe("SpatialIdMap.create", () => {
  it("new と同じマップを作る", () => {
    const entries: [SingleId, number][] = [
      [first, 10],
      [second, 20],
    ];
    expect(singles(SpatialIdMap.create(entries))).toEqual(
      singles(new SpatialIdMap(entries)),
    );
    expect(SpatialIdMap.create<number>().isEmpty()).toBe(true);
  });
});

describe("SpatialIdMap の値の比べ方", () => {
  // 4/2:3/2:3/2:3 の8つの子は、同じ値ならズーム3の1つにまとまる
  const children: SingleId[] = [];
  for (const f of [2, 3])
    for (const x of [2, 3])
      for (const y of [2, 3]) children.push(SingleId.create(4, f, x, y));
  const countWith = (value: () => unknown) =>
    new SpatialIdMap(children.map((id) => [id, value()])).count();

  it("=== で等しい値はまとめる", () => {
    expect(countWith(() => 1)).toBe(1);
    expect(countWith(() => "a")).toBe(1);
  });

  it("-0 と 0 は等しいのでまとめる", () => {
    let n = 0;
    expect(countWith(() => (n++ % 2 === 0 ? -0 : 0))).toBe(1);
  });

  it("NaN 同士はまとめない", () => {
    expect(countWith(() => Number.NaN)).toBe(8);
  });

  it("オブジェクトは参照で比べる", () => {
    const shared = {};
    expect(countWith(() => shared)).toBe(1);
    expect(countWith(() => ({}))).toBe(8);
  });
});
