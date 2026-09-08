import { describe, expect, it } from "vitest";
import { FlexId } from "../spatial-id/flexId";
import { RangeId } from "../spatial-id/rangeId";
import { SingleId } from "../spatial-id/singleId";
import {
  fromProtoFlexId,
  fromProtoRangeId,
  fromProtoSingleId,
  fromProtoSpatialId,
  fromProtoTableDataType,
  fromTypedValue,
  normalizeSpatialIds,
  toProtoFlexId,
  toProtoRangeId,
  toProtoSingleId,
  toProtoSpatialId,
  toProtoTableDataType,
  toProtoZoomLevelPolicy,
  toTypedValue,
} from "./convert";
import { TableDataType, ZoomLevelPolicy } from "./gen/common_pb";

describe("SingleId と Protobuf SingleId の相互変換", () => {
  it("全時間（時間指定なし）のIDを相互変換できる", () => {
    const single = SingleId.create(5, 3, 2, 10);
    const restored = fromProtoSingleId(toProtoSingleId(single));
    expect(restored).toEqual(single);
  });

  it("特定時間セグメントを持つIDを相互変換できる", () => {
    const single = SingleId.create(12, 0, 3638, 1614).withTime(1800, 809712);
    const pb = toProtoSingleId(single);
    expect(pb.i).toBe(1800n);
    expect(pb.t).toBe(809712n);
    expect(fromProtoSingleId(pb)).toEqual(single);
  });

  it("iとtの省略時は全時間として扱う", () => {
    const single = SingleId.create(5, 3, 2, 10);
    const pb = toProtoSingleId(single);
    pb.i = undefined;
    pb.t = undefined;
    expect(fromProtoSingleId(pb)).toEqual(single);
  });

  it("iまたはtの片方のみ指定されている場合はエラーを投げる", () => {
    const pb = toProtoSingleId(SingleId.create(5, 3, 2, 10));
    pb.t = undefined;
    expect(() => fromProtoSingleId(pb)).toThrow();
  });
});

describe("RangeId と Protobuf RangeId の相互変換", () => {
  it("全時間の範囲IDを相互変換できる", () => {
    const range = RangeId.create(4, [-3, 6], [8, 9], [5, 10]);
    expect(fromProtoRangeId(toProtoRangeId(range))).toEqual(range);
  });

  it("時間区間を持つ範囲IDを相互変換できる", () => {
    const range = RangeId.create(4, [-3, 6], [8, 9], [5, 10]).withTime(
      3600,
      [5, 8],
    );
    const pb = toProtoRangeId(range);
    expect(pb.i).toBe(3600n);
    expect(pb.t).toEqual({ min: 5n, max: 8n, $typeName: pb.t?.$typeName });
    expect(fromProtoRangeId(pb)).toEqual(range);
  });

  it("f/x/y軸が省略された場合はそのズームレベルの全範囲を補う", () => {
    const pb = toProtoRangeId(RangeId.create(4, [-3, 6], [8, 9], [5, 10]));
    pb.f = undefined;
    const restored = fromProtoRangeId(pb);
    expect(restored.f).toEqual([-16, 15]); // fMin(4)..fMax(4)
  });
});

describe("FlexId と Protobuf FlexId の相互変換", () => {
  it("全時間のFlexIdを相互変換できる", () => {
    const flex = FlexId.create(5, 3, 2, 3, 10, 1);
    expect(fromProtoFlexId(toProtoFlexId(flex))).toEqual(flex);
  });

  it("時間セグメントを持つFlexIdを相互変換できる", () => {
    const flex = FlexId.create(5, 3, 2, 3, 10, 1).withTime(25, 7);
    const pb = toProtoFlexId(flex);
    expect(pb.tZoomlevel).toBe(25);
    expect(pb.tIndex).toBe(7n);
    expect(fromProtoFlexId(pb)).toEqual(flex);
  });
});

describe("SpatialId oneof ラッパーの相互変換", () => {
  it("各バリアント（SingleId, RangeId, FlexId）をoneof経由で正しく相互変換できる", () => {
    const single = SingleId.create(5, 3, 2, 10);
    const range = RangeId.create(4, [-3, 6], [8, 9], [5, 10]);
    const flex = FlexId.create(5, 3, 2, 3, 10, 1);

    expect(fromProtoSpatialId(toProtoSpatialId(single))).toEqual(single);
    expect(fromProtoSpatialId(toProtoSpatialId(range))).toEqual(range);
    expect(fromProtoSpatialId(toProtoSpatialId(flex))).toEqual(flex);
  });

  it("oneofのcaseが存在しない場合はエラーを投げる", () => {
    const pb = toProtoSpatialId(SingleId.create(5, 3, 2, 10));
    pb.kind = { case: undefined };
    expect(() => fromProtoSpatialId(pb)).toThrow();
  });
});

describe("TypedValue と JSプリミティブ値の相互変換", () => {
  it("文字列プリミティブをTypedValueと相互変換できる", () => {
    const proto = toTypedValue("hello");
    expect(proto.kind.case).toBe("stringVal");
    expect(proto.kind.value).toBe("hello");
    expect(fromTypedValue(proto)).toBe("hello");
  });

  it("整数値をTypedValueと相互変換できる", () => {
    const proto = toTypedValue(42);
    expect(proto.kind.case).toBe("intVal");
    expect(proto.kind.value).toBe(42n);
    expect(fromTypedValue(proto)).toBe(42n);
  });

  it("bigint値をTypedValueと相互変換できる", () => {
    const proto = toTypedValue(1000n);
    expect(proto.kind.case).toBe("intVal");
    expect(proto.kind.value).toBe(1000n);
    expect(fromTypedValue(proto)).toBe(1000n);
  });

  it("真偽値をTypedValueと相互変換できる", () => {
    const protoTrue = toTypedValue(true);
    expect(protoTrue.kind.case).toBe("boolVal");
    expect(protoTrue.kind.value).toBe(true);
    expect(fromTypedValue(protoTrue)).toBe(true);

    const protoFalse = toTypedValue(false);
    expect(protoFalse.kind.case).toBe("boolVal");
    expect(protoFalse.kind.value).toBe(false);
    expect(fromTypedValue(protoFalse)).toBe(false);
  });

  it("nullおよびundefinedをnullValに変換できる", () => {
    const protoNull = toTypedValue(null);
    expect(protoNull.kind.case).toBe("nullVal");
    expect(fromTypedValue(protoNull)).toBeNull();

    const protoUndef = toTypedValue(undefined);
    expect(protoUndef.kind.case).toBe("nullVal");
    expect(fromTypedValue(protoUndef)).toBeNull();
  });

  it("既存のTypedValueオブジェクトはそのままパススルーする", () => {
    const existing = toTypedValue("passed");
    expect(toTypedValue(existing)).toBe(existing);
  });
});

describe("normalizeSpatialIds（空間IDの配列正規化）", () => {
  it("単一の空間IDを要素数1の配列に正規化できる", () => {
    const single = SingleId.create(5, 3, 2, 10);
    const result = normalizeSpatialIds(single);
    expect(result).toHaveLength(1);
    expect(result[0]?.kind.case).toBe("singleId");
  });

  it("空間IDの配列を正しく正規化できる", () => {
    const single = SingleId.create(5, 3, 2, 10);
    const range = RangeId.create(4, [-3, 6], [8, 9], [5, 10]);
    const result = normalizeSpatialIds([single, range]);
    expect(result).toHaveLength(2);
    expect(result[0]?.kind.case).toBe("singleId");
    expect(result[1]?.kind.case).toBe("rangeId");
  });
});

describe("toProtoZoomLevelPolicy（ズームレベルポリシーの変換）", () => {
  it("省略時はデフォルトでERRORになる", () => {
    expect(toProtoZoomLevelPolicy()).toBe(ZoomLevelPolicy.ERROR);
    expect(toProtoZoomLevelPolicy(undefined)).toBe(ZoomLevelPolicy.ERROR);
  });

  it("文字列リテラルを対応するEnum値へ変換できる", () => {
    expect(toProtoZoomLevelPolicy("error")).toBe(ZoomLevelPolicy.ERROR);
    expect(toProtoZoomLevelPolicy("ignore")).toBe(ZoomLevelPolicy.IGNORE);
    expect(toProtoZoomLevelPolicy("normalize")).toBe(ZoomLevelPolicy.NORMALIZE);
  });
});

describe("TableDataType の相互変換", () => {
  it("Enum値を文字列リテラルへ戻せる", () => {
    expect(fromProtoTableDataType(TableDataType.TEXT)).toBe("text");
    expect(fromProtoTableDataType(TableDataType.INT)).toBe("int");
    expect(fromProtoTableDataType(TableDataType.BOOLEAN)).toBe("boolean");
    expect(fromProtoTableDataType(TableDataType.ENUM)).toBe("enum");
    expect(fromProtoTableDataType(TableDataType.PRESENCE)).toBe("presence");
  });

  it("往復させても元に戻る", () => {
    for (const type of [
      "text",
      "int",
      "boolean",
      "enum",
      "presence",
    ] as const) {
      expect(fromProtoTableDataType(toProtoTableDataType(type))).toBe(type);
    }
  });

  it("UNSPECIFIED や未知の値は throw する", () => {
    expect(() => fromProtoTableDataType(TableDataType.UNSPECIFIED)).toThrow(
      "Unknown TableDataType: 0",
    );
    expect(() => fromProtoTableDataType(999 as TableDataType)).toThrow(
      "Unknown TableDataType: 999",
    );
  });
});
