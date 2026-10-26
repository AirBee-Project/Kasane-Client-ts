import { GeometryError } from "./error.js";
import { SingleId } from "./singleId.js";
import { checkZoom } from "./utils.js";

const MAX_LATITUDE = 85.0511;
const MAX_LONGITUDE = 180;
const MAX_ALTITUDE = 2 ** 25;

export class Coordinate {
  public readonly latitude: number;
  public readonly longitude: number;
  public readonly altitude: number;

  private constructor(latitude: number, longitude: number, altitude: number) {
    this.latitude = latitude;
    this.longitude = longitude;
    this.altitude = altitude;
  }

  /**
   * 指定された値から {@link Coordinate} を作成する。
   * 値が範囲外の場合はエラーを投げる。
   */
  public static create(
    latitude: number,
    longitude: number,
    altitude: number,
  ): Coordinate {
    if (!(latitude >= -MAX_LATITUDE && latitude <= MAX_LATITUDE)) {
      throw new GeometryError({ kind: "LatitudeOutOfRange", latitude });
    }
    if (!(longitude >= -MAX_LONGITUDE && longitude <= MAX_LONGITUDE)) {
      throw new GeometryError({ kind: "LongitudeOutOfRange", longitude });
    }
    if (!(altitude >= -MAX_ALTITUDE && altitude <= MAX_ALTITUDE)) {
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

  /** この座標を含む、ズームレベル `z` のボクセルの {@link SingleId} を返す。 */
  public toSingleId(z: number): SingleId {
    checkZoom(z);
    const n = 2 ** z;

    const f = Math.floor((this.altitude * n) / MAX_ALTITUDE);
    const x = Math.floor(((this.longitude + 180) / 360) * n);
    const rad = this.latitude * (Math.PI / 180);
    const y = Math.floor(
      ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
    );

    return SingleId.createUnchecked(
      z,
      clamp(f, -n, n - 1),
      clamp(x, 0, n - 1),
      clamp(y, 0, n - 1),
    );
  }
}

export type CoordinateRange = {
  latitude: [number, number];
  longitude: [number, number];
  altitude: [number, number];
};

export function singleIdToCenterCoordinate(id: SingleId): Coordinate {
  const { z, f, x, y } = id;
  return Coordinate.createUnchecked(
    yToLatitude(z, y + 0.5),
    xToLongitude(z, x + 0.5),
    fToAltitude(z, f + 0.5),
  );
}

export function singleIdToCoordinateRange(id: SingleId): CoordinateRange {
  const { z, f, x, y } = id;
  return {
    latitude: [yToLatitude(z, y + 1), yToLatitude(z, y)],
    longitude: [xToLongitude(z, x), xToLongitude(z, x + 1)],
    altitude: [fToAltitude(z, f), fToAltitude(z, f + 1)],
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

function xToLongitude(z: number, x: number): number {
  return (x / 2 ** z) * 360 - 180;
}

function yToLatitude(z: number, y: number): number {
  const t = Math.PI * (1 - (2 * y) / 2 ** z);
  return Math.atan(Math.sinh(t)) * (180 / Math.PI); // Rust の to_degrees() と同じ順で計算する
}

function fToAltitude(z: number, f: number): number {
  return (f * MAX_ALTITUDE) / 2 ** z;
}
