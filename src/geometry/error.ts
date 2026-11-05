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
    }
  | {
      /** Solid が閉じていない（奇数回しか現れない辺がある）。 */
      kind: "SolidNotWatertight";
      /** 奇数回しか現れなかった辺の数。 */
      openEdgeCount: number;
    }
  | {
      /** 半径が正でない。 */
      kind: "RadiusNegative";
      /** 指定された半径。 */
      radius: number;
    }
  | {
      /** 許容誤差が負または有限でない。 */
      kind: "EpsilonOutOfRange";
      /** 指定された許容誤差。 */
      epsilon: number;
    }
  | {
      /** `f` が、ズームレベルに対して有効範囲外。 */
      kind: "FractionalFOutOfRange";
      /** ズームレベル。 */
      z: number;
      /** 指定された `f`。 */
      f: number;
    }
  | {
      /** `x` が、ズームレベルに対して有効範囲外。 */
      kind: "FractionalXOutOfRange";
      /** ズームレベル。 */
      z: number;
      /** 指定された `x`。 */
      x: number;
    }
  | {
      /** `y` が、ズームレベルに対して有効範囲外。 */
      kind: "FractionalYOutOfRange";
      /** ズームレベル。 */
      z: number;
      /** 指定された `y`。 */
      y: number;
    };

/** 座標や図形の検証で発生するエラー。 */
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
      case "SolidNotWatertight":
        return `Solid is not watertight (closed). Found ${info.openEdgeCount} open edges.`;
      case "RadiusNegative":
        return `Radius need to be positive (radius = ${info.radius}).`;
      case "EpsilonOutOfRange":
        return `Epsilon must be a non-negative finite number (epsilon = ${info.epsilon})`;
      case "FractionalFOutOfRange":
        return `Fractional F coordinate '${info.f}' is out of range for ZoomLevel '${info.z}'`;
      case "FractionalXOutOfRange":
        return `Fractional X coordinate '${info.x}' is out of range for ZoomLevel '${info.z}'`;
      case "FractionalYOutOfRange":
        return `Fractional Y coordinate '${info.y}' is out of range for ZoomLevel '${info.z}'`;
    }
  }
}
