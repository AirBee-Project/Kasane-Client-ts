/**
 * 3 次元ベクトル。ECEF の `(x, y, z)` と空間 ID の `(f, x, y)` の両方に使う内部用の型。
 *
 * @internal
 */
export class Vec3 {
  public readonly a: number;
  public readonly b: number;
  public readonly c: number;

  constructor(a: number, b: number, c: number) {
    this.a = a;
    this.b = b;
    this.c = c;
  }

  public add(o: Vec3): Vec3 {
    return new Vec3(this.a + o.a, this.b + o.b, this.c + o.c);
  }

  public sub(o: Vec3): Vec3 {
    return new Vec3(this.a - o.a, this.b - o.b, this.c - o.c);
  }

  public scale(s: number): Vec3 {
    return new Vec3(this.a * s, this.b * s, this.c * s);
  }

  public dot(o: Vec3): number {
    return this.a * o.a + this.b * o.b + this.c * o.c;
  }

  public cross(o: Vec3): Vec3 {
    return new Vec3(
      this.b * o.c - this.c * o.b,
      this.c * o.a - this.a * o.c,
      this.a * o.b - this.b * o.a,
    );
  }

  public normSquared(): number {
    return this.a * this.a + this.b * this.b + this.c * this.c;
  }

  public norm(): number {
    return Math.sqrt(this.normSquared());
  }

  /** 同じ向きの単位ベクトルを返す。ゼロベクトルなら `null`。 */
  public normalize(): Vec3 | null {
    const n = this.norm();
    return n === 0 ? null : new Vec3(this.a / n, this.b / n, this.c / n);
  }

  /** このベクトルに垂直な平面の直交基底を返す。始点は原点。 */
  public createOrthonormalBasis(): [Vec3, Vec3] {
    if (this.a === 0 && this.b === 0) {
      return [new Vec3(1, 0, 0), new Vec3(0, 1, 0)];
    }
    return [
      new Vec3(-this.b, this.a, 0).normalize() as Vec3,
      new Vec3(
        -this.c * this.a,
        -this.c * this.b,
        this.a * this.a + this.b * this.b,
      ).normalize() as Vec3,
    ];
  }
}
