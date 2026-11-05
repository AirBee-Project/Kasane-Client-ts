/**
 * {@link GeometryError} の種類と、失敗した値。`kind` で判別する。
 *
 * @inline
 * @hidden
 */
export type GeometryErrorInfo =
  | {
      /** 緯度が有効範囲外。 */
      kind: "LatitudeOutOfRange";
      /** 指定された緯度。 */
      latitude: number;
    }
  | {
      /** 経度が有効範囲外。 */
      kind: "LongitudeOutOfRange";
      /** 指定された経度。 */
      longitude: number;
    }
  | {
      /** 高度が有効範囲外。 */
      kind: "AltitudeOutOfRange";
      /** 指定された高度。 */
      altitude: number;
    };

/** 座標の検証で発生するエラー。 */
export class GeometryError extends Error {
  /** エラーの種類と、失敗した値。 */
  public readonly info: GeometryErrorInfo;

  constructor(info: GeometryErrorInfo) {
    super(GeometryError.formatMessage(info));
    this.name = "GeometryError";
    this.info = info;
  }

  private static formatMessage(info: GeometryErrorInfo): string {
    switch (info.kind) {
      case "LatitudeOutOfRange":
        return `Latitude '${info.latitude}' is out of range`;
      case "LongitudeOutOfRange":
        return `Longitude '${info.longitude}' is out of range`;
      case "AltitudeOutOfRange":
        return `Altitude '${info.altitude}' is out of range`;
    }
  }
}
