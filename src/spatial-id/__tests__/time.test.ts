import { describe, expect, it } from "vitest";
import { SpatialIdError } from "../error.js";
import { Interval } from "../interval.js";
import { RangeId } from "../rangeId.js";
import { SingleId } from "../singleId.js";

function expectKind(fn: () => unknown, kind: SpatialIdError["info"]["kind"]) {
  try {
    fn();
    expect.unreachable();
  } catch (e) {
    expect(e).toBeInstanceOf(SpatialIdError);
    expect((e as SpatialIdError).info.kind).toBe(kind);
  }
}

describe("Interval.indexAt", () => {
  it("t = floor(u / i) を返す", () => {
    expect(Interval.create(1800).indexAt(1_457_482_000)).toBe(809712);
    expect(Interval.HOUR.indexAt(3599)).toBe(0);
    expect(Interval.HOUR.indexAt(3600)).toBe(1);
  });

  it("負の時刻や有限でない値はエラーを投げる", () => {
    expectKind(() => Interval.HOUR.indexAt(-1), "TOutOfRange");
    expectKind(() => Interval.HOUR.indexAt(Number.NaN), "TOutOfRange");
  });

  it("エラーには時刻ではなく計算後の t が入る", () => {
    try {
      Interval.HOUR.indexAt(-7200);
      expect.unreachable();
    } catch (e) {
      expect((e as SpatialIdError).info).toEqual({
        kind: "TOutOfRange",
        i: 3600,
        t: -2,
      });
    }
  });
});

describe("withTimeAt", () => {
  it("SingleId は Unix 時刻が属する時間インデックスを設定する", () => {
    const id = SingleId.create(12, 0, 3638, 1614).withTimeAt(
      1800,
      1_457_482_000,
    );
    expect(id.toString()).toBe("12/0/3638/1614_1800/809712");
  });

  it("RangeId は t の両端が同じになる", () => {
    const id = RangeId.create(4, 0, 0, 0).withTimeAt(1800, 1_457_482_000);
    expect(id.t).toEqual([809712, 809712]);
  });
});

describe("withTimeSpan", () => {
  it("RangeId は複数にまたがる区間も受け付ける", () => {
    const id = RangeId.create(4, 0, 0, 0).withTimeSpan(1800, 7200);
    expect(id.interval.seconds()).toBe(1800);
    expect(id.t).toEqual([1, 3]);
  });

  it("start が 0 なら区間幅がそのまま時間間隔になる", () => {
    const id = RangeId.create(4, 0, 0, 0).withTimeSpan(0, 86_400);
    expect(id.interval.seconds()).toBe(86_400);
    expect(id.t).toEqual([0, 0]);
  });

  it("不正な区間は TOutOfRange を投げる", () => {
    const id = RangeId.create(4, 0, 0, 0);
    expectKind(() => id.withTimeSpan(100, 100), "TOutOfRange");
    expectKind(() => id.withTimeSpan(200, 100), "TOutOfRange");
    expectKind(
      () => id.withTimeSpan(0, Interval.MAX_SECONDS + 1),
      "TOutOfRange",
    );
    expectKind(() => id.withTimeSpan(0.5, 100), "TOutOfRange");
  });
});

describe("withoutTime / secondsRange / containsTime", () => {
  it("withoutTime で全時間に戻る", () => {
    expect(
      SingleId.create(5, 3, 2, 10)
        .withTime(3600, 5)
        .withoutTime()
        .isWholeTime(),
    ).toBe(true);
    expect(
      RangeId.create(4, 0, 0, 0)
        .withTime(Interval.HOUR, [0, 1])
        .withoutTime()
        .isWholeTime(),
    ).toBe(true);
  });

  it("secondsRange は終端を含まない絶対秒区間を返す", () => {
    expect(
      SingleId.create(5, 3, 2, 10).withTime(3600, 5).secondsRange(),
    ).toEqual([18_000, 21_600]);
    expect(
      RangeId.create(4, 0, 0, 0).withTime(3600, [2, 4]).secondsRange(),
    ).toEqual([7200, 18_000]);
  });

  it("全時間の ID は [0, 2^35] になる", () => {
    expect(SingleId.create(5, 3, 2, 10).secondsRange()).toEqual([
      0,
      Interval.MAX_SECONDS,
    ]);
  });

  it("containsTime は始端を含み、終端を含まない", () => {
    const id = SingleId.create(5, 3, 2, 10).withTime(3600, 5);
    expect(id.containsTime(18_000)).toBe(true);
    expect(id.containsTime(21_599)).toBe(true);
    expect(id.containsTime(21_600)).toBe(false);
    expect(id.containsTime(17_999)).toBe(false);
  });

  it("withTimeSpan で設定した区間が secondsRange で戻る", () => {
    const id = RangeId.create(4, 0, 0, 0).withTimeSpan(1800, 7200);
    expect(id.secondsRange()).toEqual([1800, 7200]);
  });
});
