import { SingleId } from "../spatial-id/singleId.js";
import { ZoomLevel } from "../spatial-id/zoomLevel.js";
import { GeometryError } from "./error.js";

/** 緯度・経度・高度で表す座標。 */
export class Coordinate {
  private static readonly MAX_LATITUDE = 85.0511;
  private static readonly MAX_LONGITUDE = 180;
  private static readonly MAX_ALTITUDE = 2 ** 25;

  /** 緯度（度）。 */
  public readonly latitude: number;
  /** 経度（度）。 */
  public readonly longitude: number;
  /** 高度。 */
  public readonly altitude: number;

  private constructor(latitude: number, longitude: number, altitude: number) {
    this.latitude = latitude;
    this.longitude = longitude;
    this.altitude = altitude;
  }

  /**
   * 指定された値から {@link Coordinate} を作成する。
   *
   * @throws {@link GeometryError} `LatitudeOutOfRange` `latitude` が範囲外のとき
   * @throws {@link GeometryError} `LongitudeOutOfRange` `longitude` が範囲外のとき
   * @throws {@link GeometryError} `AltitudeOutOfRange` `altitude` が範囲外のとき
   */
  public static create(
    latitude: number,
    longitude: number,
    altitude: number,
  ): Coordinate {
    if (
      !(
        latitude >= -Coordinate.MAX_LATITUDE &&
        latitude <= Coordinate.MAX_LATITUDE
      )
    ) {
      throw new GeometryError({ kind: "LatitudeOutOfRange", latitude });
    }
    if (
      !(
        longitude >= -Coordinate.MAX_LONGITUDE &&
        longitude <= Coordinate.MAX_LONGITUDE
      )
    ) {
      throw new GeometryError({ kind: "LongitudeOutOfRange", longitude });
    }
    if (
      !(
        altitude >= -Coordinate.MAX_ALTITUDE &&
        altitude <= Coordinate.MAX_ALTITUDE
      )
    ) {
      throw new GeometryError({ kind: "AltitudeOutOfRange", altitude });
    }
    return new Coordinate(latitude, longitude, altitude);
  }

  /**
   * 範囲チェックを行わずに {@link Coordinate} を作成する。
   */
  public static createUnchecked(
    latitude: number,
    longitude: number,
    altitude: number,
  ): Coordinate {
    return new Coordinate(latitude, longitude, altitude);
  }

  /**
   * `"{latitude}, {longitude}, {altitude}"` の形式で出力する。
   * 順序は {@link Coordinate.create} の引数と同じ。
   */
  public toString(): string {
    return `${this.latitude}, ${this.longitude}, ${this.altitude}`;
  }

  /**
   * この座標を含む、ズームレベル `z` のボクセルの {@link SingleId} を返す。
   *
   * @throws {@link spatial-id!SpatialIdError} `ZOutOfRange` `z` が範囲外のとき
   */
  public singleId(z: number): SingleId {
    ZoomLevel.create(z);
    const n = 2 ** z;

    const f = Math.floor((this.altitude * n) / Coordinate.MAX_ALTITUDE);
    const x = Math.floor(((this.longitude + 180) / 360) * n);
    const rad = this.latitude * (Math.PI / 180);
    const y = Math.floor(
      ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
    );

    return SingleId.createUnchecked(
      z,
      Coordinate.clamp(f, -n, n - 1),
      Coordinate.clamp(x, 0, n - 1),
      Coordinate.clamp(y, 0, n - 1),
    );
  }

  /**
   * ズームレベル `z` の（小数を含む）インデックス `f`, `x`, `y` が指す点の座標を返す。
   * セグメントの端なら整数、中心なら `+0.5` した値を渡す。
   *
   * @internal
   */
  public static fromIndex(
    z: number,
    f: number,
    x: number,
    y: number,
  ): Coordinate {
    const n = 2 ** z;
    const t = Math.PI * (1 - (2 * y) / n);
    return new Coordinate(
      Math.atan(Math.sinh(t)) * (180 / Math.PI), // Rust の to_degrees() と同じ順で計算する
      (x / n) * 360 - 180,
      (f * Coordinate.MAX_ALTITUDE) / n,
    );
  }

  /**
   * `min` と `max` を対角とする {@link CoordinateRange} を返す。
   *
   * @internal
   */
  public static range(min: Coordinate, max: Coordinate): CoordinateRange {
    return {
      latitude: [min.latitude, max.latitude],
      longitude: [min.longitude, max.longitude],
      altitude: [min.altitude, max.altitude],
    };
  }

  private static clamp(v: number, min: number, max: number): number {
    return Math.min(Math.max(v, min), max);
  }
}

/** ボクセルが占める範囲。 */
export type CoordinateRange = {
  /** 緯度の範囲 `[最小, 最大]`。 */
  latitude: readonly [number, number];
  /** 経度の範囲 `[最小, 最大]`。 */
  longitude: readonly [number, number];
  /** 高度の範囲 `[最小, 最大]`。 */
  altitude: readonly [number, number];
};
