/**
 * {@link SpatialIdError} の種類と、失敗した値。`kind` で判別する。
 *
 * @inline
 * @hidden
 */
export type SpatialIdErrorInfo =
  | {
      /** ズームレベル `z` が有効範囲外。 */
      kind: "ZOutOfRange";
      /** 指定されたズームレベル。 */
      z: number;
    }
  | {
      /** 高度方向インデックス `f` が、ズームレベル `z` の範囲外。 */
      kind: "FOutOfRange";
      /** ズームレベル。 */
      z: number;
      /** 指定された高度方向インデックス。 */
      f: number;
    }
  | {
      /** X 方向インデックス `x` が、ズームレベル `z` の範囲外。 */
      kind: "XOutOfRange";
      /** ズームレベル。 */
      z: number;
      /** 指定された X 方向インデックス。 */
      x: number;
    }
  | {
      /** Y 方向インデックス `y` が、ズームレベル `z` の範囲外。 */
      kind: "YOutOfRange";
      /** ズームレベル。 */
      z: number;
      /** 指定された Y 方向インデックス。 */
      y: number;
    }
  | {
      /** 時間インデックス `t` が、時間間隔 `i` に対して範囲外。 */
      kind: "TOutOfRange";
      /** 時間間隔（秒）。 */
      i: number;
      /** 指定された時間インデックス。 */
      t: number;
    }
  | {
      /** 時間間隔 `i` が不正。 */
      kind: "TIntervalError";
      /** 指定された時間間隔（秒）。 */
      i: number;
    }
  | {
      /** 文字列 `input` を `idKind` として解釈できない。 */
      kind: "ParseSpatialIdFormat";
      /** 解釈しようとした ID の型。 */
      idKind: "SingleId" | "RangeId" | "FlexId";
      /** 解釈できなかった文字列。 */
      input: string;
    };

/** 空間 ID の生成・変換・解析で発生するエラー。 */
export class SpatialIdError extends Error {
  /** エラーの種類と、失敗した値。 */
  public readonly info: SpatialIdErrorInfo;

  constructor(info: SpatialIdErrorInfo) {
    super(SpatialIdError.formatMessage(info));
    this.name = "SpatialIdError";
    this.info = info;
  }

  private static formatMessage(info: SpatialIdErrorInfo): string {
    switch (info.kind) {
      case "ZOutOfRange":
        return `ZoomLevel '${info.z}' is out of range`;
      case "FOutOfRange":
        return `F coordinate '${info.f}' is out of range for ZoomLevel '${info.z}'`;
      case "XOutOfRange":
        return `X coordinate '${info.x}' is out of range for ZoomLevel '${info.z}'`;
      case "YOutOfRange":
        return `Y coordinate '${info.y}' is out of range for ZoomLevel '${info.z}'`;
      case "TOutOfRange":
        return `Time index 't=${info.t}' is out of range for interval 'i=${info.i}'`;
      case "TIntervalError":
        return `Time interval 'i=${info.i}' is invalid (must be a positive integer no greater than Interval.MAX_SECONDS)`;
      case "ParseSpatialIdFormat":
        return `Failed to parse ${info.idKind} from '${info.input}'`;
    }
  }
}
