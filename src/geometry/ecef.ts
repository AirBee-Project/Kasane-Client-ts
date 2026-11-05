import {
  ALT_ABS_MAX,
  DEG_TO_RAD,
  LAT_ABS_MAX,
  RAD_TO_DEG,
  WGS84_A,
  WGS84_B,
  WGS84_E2,
  WGS84_F,
} from "./constants.js";
import { Coordinate } from "./coordinate.js";
import type { FractionalId } from "./fractionalId.js";
import { Point } from "./point.js";
import { Vec3 } from "./vec3.js";

// 緯度・高度の範囲内であることを、四則演算だけで早期に判定するための境界値
const NEAREDGE_P2 = 336394929032.94604;
const NEAREDGE_Z2 = 40074157011110.21;
const MAX_R2 = (WGS84_B + ALT_ABS_MAX) * (WGS84_B + ALT_ABS_MAX);

const LATITUDE_TOLERANCE = 1e-9;
const ALTITUDE_TOLERANCE = 1e-2;

/**
 * 地心直交座標（ECEF、メートル）。
 *
 * @category Point
 */
export class Ecef extends Point {
  /** X 座標（m）。 */
  public readonly x: number;
  /** Y 座標（m）。 */
  public readonly y: number;
  /** Z 座標（m）。 */
  public readonly z: number;

  private constructor(x: number, y: number, z: number) {
    super();
    this.x = x;
    this.y = y;
    this.z = z;
  }

  /**
   * 指定された値から {@link Ecef} を作成する。
   * 緯度・経度・高度が {@link Coordinate} の範囲に収まる点だけを受け付ける。
   *
   * @throws {@link GeometryError} `LatitudeOutOfRange` `LongitudeOutOfRange` `AltitudeOutOfRange` 範囲外のとき
   */
  public static create(x: number, y: number, z: number): Ecef {
    const p2 = x * x + y * y;
    const z2 = z * z;
    const rOk = p2 + z2 <= MAX_R2;
    const latOk =
      (z2 < NEAREDGE_Z2 && p2 > NEAREDGE_P2) ||
      (z2 > NEAREDGE_Z2 && z2 / p2 < NEAREDGE_Z2 / NEAREDGE_P2);
    // 明らかに範囲内の点は四則演算だけで受理し、境界に近い点だけを厳密に検証する
    if (!(rOk && latOk)) {
      Coordinate.fromVec3(new Vec3(x, y, z));
    }
    return new Ecef(x, y, z);
  }

  /** 範囲チェックを行わずに {@link Ecef} を作成する。 */
  public static createUnchecked(x: number, y: number, z: number): Ecef {
    return new Ecef(x, y, z);
  }

  /** `x` だけを差し替えた {@link Ecef} を返す。 */
  public withX(x: number): Ecef {
    return Ecef.create(x, this.y, this.z);
  }

  /** `y` だけを差し替えた {@link Ecef} を返す。 */
  public withY(y: number): Ecef {
    return Ecef.create(this.x, y, this.z);
  }

  /** `z` だけを差し替えた {@link Ecef} を返す。 */
  public withZ(z: number): Ecef {
    return Ecef.create(this.x, this.y, z);
  }

  /** 2 点間のユークリッド距離（m）。 */
  public distance(other: Ecef): number {
    return Math.sqrt(
      (this.x - other.x) * (this.x - other.x) +
        (this.y - other.y) * (this.y - other.y) +
        (this.z - other.z) * (this.z - other.z),
    );
  }

  /** 原点からの距離の 2 乗。 */
  public normSquared(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  /** 緯度・経度・高度の {@link Coordinate} に変換する。 */
  public toCoordinate(): Coordinate {
    const [lat, lon, h] = ecefToGeodetic(this.x, this.y, this.z);
    return Coordinate.createUnchecked(lat, lon, h);
  }

  public toEcef(): Ecef {
    return this;
  }

  public fractionalId(z: number): FractionalId {
    return this.toCoordinate().fractionalId(z);
  }

  /** `"{x}, {y}, {z}"` の形式で出力する。 */
  public override toString(): string {
    return `${this.x}, ${this.y}, ${this.z}`;
  }

  /** @internal */
  public toVec3(): Vec3 {
    return new Vec3(this.x, this.y, this.z);
  }

  /** @internal */
  public component(index: 0 | 1 | 2): number {
    return index === 0 ? this.x : index === 1 ? this.y : this.z;
  }
}

/**
 * ECEF から測地座標 `[緯度（度）, 経度（度）, 高度（m）]` を求める（Bowring の初期値による反復）。
 * 範囲の境界をわずかに超えた値は、許容誤差の内側なら境界に丸める。
 *
 * @internal
 */
export function ecefToGeodetic(
  x: number,
  y: number,
  z: number,
): [number, number, number] {
  const lon = Math.atan2(y, x);
  const p = Math.sqrt(x * x + y * y);

  let lat = Math.atan2(z / p, 1.0 - WGS84_F);
  let h = 0.0;

  for (let i = 0; i < 10; i++) {
    const sinLat = Math.sin(lat);
    const n = WGS84_A / Math.sqrt(1.0 - WGS84_E2 * sinLat * sinLat);
    h = p / Math.cos(lat) - n;

    const newLat = Math.atan2(z + WGS84_E2 * n * sinLat, p);

    if (Math.abs(newLat - lat) < 1e-12) {
      lat = newLat;
      break;
    }
    lat = newLat;
  }

  return [
    snapToBound(lat * RAD_TO_DEG, LAT_ABS_MAX, LATITUDE_TOLERANCE),
    lon * RAD_TO_DEG,
    snapToBound(h, ALT_ABS_MAX, ALTITUDE_TOLERANCE),
  ];
}

function snapToBound(value: number, bound: number, tolerance: number): number {
  if (value > bound && value <= bound + tolerance) {
    return bound;
  }
  if (value < -bound && value >= -bound - tolerance) {
    return -bound;
  }
  return value;
}

/**
 * 測地座標から ECEF を求める。
 *
 * @internal
 */
export function geodeticToEcef(
  latitude: number,
  longitude: number,
  altitude: number,
): Ecef {
  const lat = latitude * DEG_TO_RAD;
  const lon = longitude * DEG_TO_RAD;

  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const sinLon = Math.sin(lon);
  const cosLon = Math.cos(lon);

  const n = WGS84_A / Math.sqrt(1.0 - WGS84_E2 * sinLat * sinLat);

  return Ecef.createUnchecked(
    (n + altitude) * cosLat * cosLon,
    (n + altitude) * cosLat * sinLon,
    (n * (1.0 - WGS84_E2) + altitude) * sinLat,
  );
}
