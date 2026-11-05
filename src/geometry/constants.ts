/** WGS-84 楕円体の長半径（赤道半径）[m]。 */
export const WGS84_A = 6_378_137.0;

/** WGS-84 楕円体の逆扁平率（1 / f）。 */
export const WGS84_INV_F = 298.257_223_563;

/** WGS-84 楕円体の扁平率 `f`。 */
export const WGS84_F = 1.0 / WGS84_INV_F;

/** WGS-84 楕円体の短半径（極半径）[m]。 */
export const WGS84_B = WGS84_A * (1.0 - WGS84_F);

/** WGS-84 楕円体の第一離心率の二乗（e²）。 */
export const WGS84_E2 = 1.0 - (WGS84_B * WGS84_B) / (WGS84_A * WGS84_A);

/** 緯度の絶対値の上限（度）。Web メルカトルの範囲に合わせている。 */
export const LAT_ABS_MAX = 85.0511;

/** 経度の絶対値の上限（度）。 */
export const LON_ABS_MAX = 180;

/** 高度の絶対値の上限（m）。ズームレベル 25 でちょうど 1m 刻みになる値。 */
export const ALT_ABS_MAX = 2 ** 25;

/** 度からラジアンへの変換係数。Rust の `to_radians()` と同じ式にそろえる。 */
export const DEG_TO_RAD = Math.PI / 180;

/** ラジアンから度への変換係数。Rust の `to_degrees()` と同じ式にそろえる。 */
export const RAD_TO_DEG = 180 / Math.PI;
