export type SpatialIdErrorInfo =
  | { kind: "ZOutOfRange"; z: number }
  | { kind: "FOutOfRange"; z: number; f: number }
  | { kind: "XOutOfRange"; z: number; x: number }
  | { kind: "YOutOfRange"; z: number; y: number }
  | { kind: "TOutOfRange"; i: number; t: number }
  | { kind: "TIntervalError"; i: number }
  | {
      kind: "ParseSpatialIdFormat";
      idKind: "SingleId" | "RangeId" | "FlexId";
      input: string;
    };

export class SpatialIdError extends Error {
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
