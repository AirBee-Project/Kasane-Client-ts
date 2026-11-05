import { SingleId } from "../spatial-id/singleId.js";
import { ZoomLevel } from "../spatial-id/zoomLevel.js";
import { ALT_ABS_MAX, LON_ABS_MAX, RAD_TO_DEG } from "./constants.js";
import { Coordinate } from "./coordinate.js";
import type { Ecef } from "./ecef.js";
import { GeometryError } from "./error.js";
import { Point } from "./point.js";

/**
 * 小数のインデックスを持つ空間 ID。切り捨てる前の位置を保ったまま扱える。
 *
 * {@link Point.singleId} は、この値を {@link FractionalId.roundToSingleId} で丸めたもの。
 *
 * @category Point
 */
export class FractionalId extends Point {
  private readonly zoom: ZoomLevel;
  /** 高度方向のインデックス（小数）。 */
  public readonly f: number;
  /** 経度方向のインデックス（小数）。 */
  public readonly x: number;
  /** 緯度方向のインデックス（小数）。 */
  public readonly y: number;

  private constructor(zoom: ZoomLevel, f: number, x: number, y: number) {
    super();
    this.zoom = zoom;
    this.f = f;
    this.x = x;
    this.y = y;
  }

  /** ズームレベル。 */
  public get z(): number {
    return this.zoom.value;
  }

  /**
   * 指定された値から {@link FractionalId} を作成する。
   *
   * 連続値なので、上端（高度 `2^25`、経度 `180°`、緯度の南端）に当たる `2^z` までを有効とする。
   *
   * @throws {@link spatial-id!SpatialIdError} `ZOutOfRange` `z` が範囲外のとき
   * @throws {@link GeometryError} `FractionalFOutOfRange` `FractionalXOutOfRange` `FractionalYOutOfRange` 範囲外のとき
   */
  public static create(
    z: number,
    f: number,
    x: number,
    y: number,
  ): FractionalId {
    const zoom = ZoomLevel.create(z);
    const fMin = zoom.fMin();
    const fMax = zoom.fMax() + 1;
    const xyMax = zoom.xyMax() + 1;

    if (!(f >= fMin && f <= fMax && Number.isFinite(f))) {
      throw new GeometryError({ kind: "FractionalFOutOfRange", z, f });
    }
    if (!(x >= 0 && x <= xyMax && Number.isFinite(x))) {
      throw new GeometryError({ kind: "FractionalXOutOfRange", z, x });
    }
    if (!(y >= 0 && y <= xyMax && Number.isFinite(y))) {
      throw new GeometryError({ kind: "FractionalYOutOfRange", z, y });
    }
    return new FractionalId(zoom, f, x, y);
  }

  /**
   * 範囲チェックを行わずに {@link FractionalId} を作成する。
   * **範囲外の値を渡した場合の挙動は未定義**になる。
   *
   * @internal
   */
  public static createUnchecked(
    z: number,
    f: number,
    x: number,
    y: number,
  ): FractionalId {
    return new FractionalId(ZoomLevel.createUnchecked(z), f, x, y);
  }

  /** `f` だけを差し替えた {@link FractionalId} を返す。範囲は {@link FractionalId.create} と同じ。 */
  public withF(f: number): FractionalId {
    return FractionalId.create(this.z, f, this.x, this.y);
  }

  /** `x` だけを差し替えた {@link FractionalId} を返す。範囲は {@link FractionalId.create} と同じ。 */
  public withX(x: number): FractionalId {
    return FractionalId.create(this.z, this.f, x, this.y);
  }

  /** `y` だけを差し替えた {@link FractionalId} を返す。範囲は {@link FractionalId.create} と同じ。 */
  public withY(y: number): FractionalId {
    return FractionalId.create(this.z, this.f, this.x, y);
  }

  /** 各インデックスを切り捨てて {@link SingleId} にする。上端ちょうどの値は最後のインデックスに丸める。 */
  public roundToSingleId(): SingleId {
    return SingleId.createUnchecked(
      this.z,
      Math.min(Math.floor(this.f), this.zoom.fMax()),
      Math.min(Math.floor(this.x), this.zoom.xyMax()),
      Math.min(Math.floor(this.y), this.zoom.xyMax()),
    );
  }

  /**
   * ズームレベルを `z` に変えた {@link FractionalId} を返す。位置は変わらない。
   *
   * @throws {@link spatial-id!SpatialIdError} `ZOutOfRange` `z` が範囲外のとき
   */
  public intoAnotherZoomlevel(z: number): FractionalId {
    const zoom = ZoomLevel.create(z);
    const dz = z - this.z;
    if (dz === 0) {
      return this;
    }
    const scale = 2 ** dz;
    return new FractionalId(
      zoom,
      this.f * scale,
      this.x * scale,
      this.y * scale,
    );
  }

  /** この位置の {@link Coordinate} に変換する。 */
  public toCoordinate(): Coordinate {
    const n = 2 ** this.z;
    const alt = ALT_ABS_MAX * (this.f / n);
    const t = Math.PI * (1.0 - 2.0 * (this.y / n));
    const lat = Math.atan(Math.sinh(t)) * RAD_TO_DEG;
    const lon = 2.0 * LON_ABS_MAX * (this.x / n) - LON_ABS_MAX;
    return Coordinate.create(lat, lon, alt);
  }

  public toEcef(): Ecef {
    return this.toCoordinate().toEcef();
  }

  public fractionalId(z: number): FractionalId {
    return this.intoAnotherZoomlevel(z);
  }

  /** `"{z}/{f}/{x}/{y}"` の形式で出力する。 */
  public override toString(): string {
    return `${this.z}/${this.f}/${this.x}/${this.y}`;
  }
}
