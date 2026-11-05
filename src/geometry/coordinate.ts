import { ZoomLevel } from "../spatial-id/zoomLevel.js";
import {
  ALT_ABS_MAX,
  DEG_TO_RAD,
  LAT_ABS_MAX,
  LON_ABS_MAX,
  RAD_TO_DEG,
} from "./constants.js";
import { type Ecef, ecefToGeodetic, geodeticToEcef } from "./ecef.js";
import { GeometryError } from "./error.js";
import { FractionalId } from "./fractionalId.js";
import { Point } from "./point.js";
import type { Vec3 } from "./vec3.js";

/**
 * 緯度・経度・高度で表す座標。
 *
 * @category Point
 */
export class Coordinate extends Point {
  /** 緯度（度）。 */
  public readonly latitude: number;
  /** 経度（度）。 */
  public readonly longitude: number;
  /** 高度。 */
  public readonly altitude: number;

  private constructor(latitude: number, longitude: number, altitude: number) {
    super();
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
    Coordinate.checkLatitude(latitude);
    Coordinate.checkLongitude(longitude);
    Coordinate.checkAltitude(altitude);
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
   * `latitude` だけを差し替えた {@link Coordinate} を返す。
   *
   * @throws {@link GeometryError} `LatitudeOutOfRange` `latitude` が範囲外のとき
   */
  public withLatitude(latitude: number): Coordinate {
    Coordinate.checkLatitude(latitude);
    return new Coordinate(latitude, this.longitude, this.altitude);
  }

  /**
   * `longitude` だけを差し替えた {@link Coordinate} を返す。
   *
   * @throws {@link GeometryError} `LongitudeOutOfRange` `longitude` が範囲外のとき
   */
  public withLongitude(longitude: number): Coordinate {
    Coordinate.checkLongitude(longitude);
    return new Coordinate(this.latitude, longitude, this.altitude);
  }

  /**
   * `altitude` だけを差し替えた {@link Coordinate} を返す。
   *
   * @throws {@link GeometryError} `AltitudeOutOfRange` `altitude` が範囲外のとき
   */
  public withAltitude(altitude: number): Coordinate {
    Coordinate.checkAltitude(altitude);
    return new Coordinate(this.latitude, this.longitude, altitude);
  }

  /** 2 点間のユークリッド距離（m）。ECEF に変換して求める。 */
  public distance(other: Coordinate): number {
    return this.toEcef().distance(other.toEcef());
  }

  /** すべての値が等しいかを判定する。 */
  public equals(other: Coordinate): boolean {
    return (
      this.latitude === other.latitude &&
      this.longitude === other.longitude &&
      this.altitude === other.altitude
    );
  }

  /**
   * 座標群の重心を返す。空なら `(0, 0, 0)`。
   *
   * 経度は単純平均を基本とするが、日付変更線をまたぐ場合は 0〜360 度に直して平均する。
   */
  public static centroid(coordinates: Iterable<Coordinate>): Coordinate {
    let sumLat = 0;
    let sumLon = 0;
    let sumAlt = 0;
    let sumLon360 = 0;
    let minLon = Number.POSITIVE_INFINITY;
    let maxLon = Number.NEGATIVE_INFINITY;
    let minLon360 = Number.POSITIVE_INFINITY;
    let maxLon360 = Number.NEGATIVE_INFINITY;
    let count = 0;

    for (const c of coordinates) {
      const lon360 = c.longitude < 0 ? c.longitude + 360 : c.longitude;

      sumLat += c.latitude;
      sumLon += c.longitude;
      sumAlt += c.altitude;

      sumLon360 += lon360;
      minLon = Math.min(minLon, c.longitude);
      maxLon = Math.max(maxLon, c.longitude);
      minLon360 = Math.min(minLon360, lon360);
      maxLon360 = Math.max(maxLon360, lon360);

      count += 1;
    }

    if (count === 0) {
      return new Coordinate(0, 0, 0);
    }

    const spread = maxLon - minLon;
    let lon: number;
    if (spread > 180 && maxLon360 - minLon360 < spread) {
      const mean = sumLon360 / count;
      lon = mean > 180 ? mean - 360 : mean;
    } else {
      lon = sumLon / count;
    }

    // 浮動小数点誤差で緯度が範囲を超えないよう、収める
    const lat = Math.min(Math.max(sumLat / count, -LAT_ABS_MAX), LAT_ABS_MAX);
    return new Coordinate(lat, lon, sumAlt / count);
  }

  public toEcef(): Ecef {
    return geodeticToEcef(this.latitude, this.longitude, this.altitude);
  }

  /** @internal */
  public toVec3(): Vec3 {
    return this.toEcef().toVec3();
  }

  /**
   * この座標を、ズームレベル `z` の（小数を含む）インデックスで表した {@link FractionalId} にする。
   *
   * @throws {@link spatial-id!SpatialIdError} `ZOutOfRange` `z` が範囲外のとき
   */
  public fractionalId(z: number): FractionalId {
    ZoomLevel.create(z);
    const [f, x, y] = this.toIndex(z);
    return FractionalId.create(z, f, x, y);
  }

  /**
   * ズームレベル `z` の `[f, x, y]` を、範囲を検証せずに小数のまま求める。
   *
   * @internal
   */
  public toIndex(z: number): [number, number, number] {
    // z = 25 のとき高さがちょうど 1m になる
    const f = 2 ** (z - 25) * this.altitude;

    const n = 2 ** z;
    const x = ((this.longitude + LON_ABS_MAX) / (2 * LON_ABS_MAX)) * n;

    const latRad = this.latitude * DEG_TO_RAD;
    const y =
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
      n;

    return [f, x, y];
  }

  /**
   * `"{latitude}, {longitude}, {altitude}"` の形式で出力する。
   * 順序は {@link Coordinate.create} の引数と同じ。
   */
  public override toString(): string {
    return `${this.latitude}, ${this.longitude}, ${this.altitude}`;
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
      Math.atan(Math.sinh(t)) * RAD_TO_DEG,
      (x / n) * 360 - 180,
      (f * ALT_ABS_MAX) / n,
    );
  }

  /**
   * ECEF のベクトルから座標を求める。範囲外なら投げる。
   *
   * @throws {@link GeometryError} 緯度・経度・高度のいずれかが範囲外のとき
   * @internal
   */
  public static fromVec3(v: Vec3): Coordinate {
    const [lat, lon, h] = ecefToGeodetic(v.a, v.b, v.c);
    return Coordinate.create(lat, lon, h);
  }

  private static checkLatitude(latitude: number): void {
    if (!(latitude >= -LAT_ABS_MAX && latitude <= LAT_ABS_MAX)) {
      throw new GeometryError({ kind: "LatitudeOutOfRange", latitude });
    }
  }

  private static checkLongitude(longitude: number): void {
    if (!(longitude >= -LON_ABS_MAX && longitude <= LON_ABS_MAX)) {
      throw new GeometryError({ kind: "LongitudeOutOfRange", longitude });
    }
  }

  private static checkAltitude(altitude: number): void {
    if (!(altitude >= -ALT_ABS_MAX && altitude <= ALT_ABS_MAX)) {
      throw new GeometryError({ kind: "AltitudeOutOfRange", altitude });
    }
  }
}
