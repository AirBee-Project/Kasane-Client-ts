import { type Client, createClient, type Transport } from "@connectrpc/connect";
import { createGrpcWebTransport } from "@connectrpc/connect-web";
import { createAuthInterceptor } from "./auth.js";
import {
  normalizeSpatialIds,
  type OutputFormat,
  type SpatialId,
  type TableDataType,
  toProtoOutputFormat,
  toProtoTableDataType,
} from "./convert.js";
import { FailoverTransport } from "./failoverTransport.js";
import { AuthService } from "./gen/auth_pb.js";
import { DataService } from "./gen/data_pb.js";
import type { DatabaseInfo } from "./gen/database_pb.js";
import { DatabaseService } from "./gen/database_pb.js";
import type { QueryNode } from "./gen/query_pb.js";
import { QueryService } from "./gen/query_pb.js";
import { TableService } from "./gen/table_pb.js";
import { DatabaseHandle } from "./handle.js";
import { QueryBuilder } from "./query.js";
import { type RpcCallOptions, toCallOptions } from "./rpcCallOptions.js";
import { ResultStream } from "./stream.js";
import { WasmTransport } from "./wasmTransport.js";

/**
 * Kasaneに接続するクライアント。
 */
export class KasaneClient {
  /** @internal */
  public readonly databaseClient: Client<typeof DatabaseService>;
  /** @internal */
  public readonly tableClient: Client<typeof TableService>;
  /** @internal */
  public readonly data: Client<typeof DataService>;
  /** @internal */
  private readonly queryClient: Client<typeof QueryService>;

  private readonly onLogout: () => void;

  private constructor(transport: Transport, onLogout: () => void = () => {}) {
    this.databaseClient = createClient(DatabaseService, transport);
    this.tableClient = createClient(TableService, transport);
    this.data = createClient(DataService, transport);
    this.queryClient = createClient(QueryService, transport);
    this.onLogout = onLogout;
  }

  /**
   * サーバーへ接続・認証し、利用可能な {@link KasaneClient} を返す。
   * トークン期限切れ時は内部で自動的に再認証が行われる。
   *
   * @param servers 接続先サーバーURL（文字列またはURL配列）
   * @param username ユーザー名
   * @param password パスワード
   */
  public static async connect(
    servers: string | string[],
    username: string,
    password: string,
  ): Promise<KasaneClient> {
    const serverList = Array.isArray(servers) ? servers : [servers];
    if (serverList.length === 0) {
      throw new Error("KasaneClient requires at least one server URL");
    }

    let token: string | undefined;
    const login = async (): Promise<string> => {
      token = (await auth.login({ username, password })).token;
      return token;
    };
    const transport = new FailoverTransport(
      serverList.map((baseUrl) =>
        createGrpcWebTransport({
          baseUrl,
          interceptors: [
            createAuthInterceptor({
              getToken: () => token,
              refreshToken: login,
            }),
          ],
        }),
      ),
    );
    const auth = createClient(AuthService, transport);

    await login();
    return new KasaneClient(transport, () => {
      token = undefined;
    });
  }

  /**
   * プロセス内で動くインメモリの Kasane（Wasm）を作り、それにつながる {@link KasaneClient} を返す。
   * データはこのクライアントだけが持ち、利用者は root 固定なので認証は要らない。
   */
  public static async inMemory(): Promise<KasaneClient> {
    const { createKasane } = await import("#kasane-wasm");
    return new KasaneClient(new WasmTransport(await createKasane()));
  }

  /** 保持しているトークンを破棄する。以降の呼び出しは未認証状態になる。 */
  public logout(): void {
    this.onLogout();
  }

  /**
   * データベースを新規作成する。
   *
   * @param name データベース名
   * @param description データベースの説明文
   */
  public async createDatabase(
    name: string,
    description?: string,
  ): Promise<DatabaseInfo> {
    return await this.databaseClient.create({
      name,
      description,
    });
  }

  /**
   * データベース一覧を取得する。
   */
  public async listDatabases(options?: {
    rpcCallOptions?: RpcCallOptions;
  }): Promise<DatabaseInfo[]> {
    const res = await this.databaseClient.list(
      {},
      toCallOptions(options?.rpcCallOptions),
    );
    return res.databases;
  }

  /**
   * 指定したデータベースに対する操作スコープ（{@link DatabaseHandle}）を取得する。
   */
  public database(name: string): DatabaseHandle {
    return new DatabaseHandle(this, name);
  }

  /**
   * Queryを実行し、結果ストリームとして取得する。
   *
   * @param query 実行する空間クエリ
   * @param spatialIds 対象となる空間ID（単一または配列）
   * @param options 追加オプション（出力値の型、フォーマット、中断シグナル等）
   */
  public query<T = unknown>(
    query: QueryBuilder | QueryNode,
    spatialIds: SpatialId | SpatialId[],
    options?: {
      valueType?: TableDataType;
      format?: OutputFormat;
      rpcCallOptions?: RpcCallOptions;
    },
  ): ResultStream<T> {
    const queryNode = query instanceof QueryBuilder ? query.toProto() : query;
    const rawStream = this.queryClient.execute(
      {
        query: queryNode,
        spatialIds: normalizeSpatialIds(spatialIds),
        valueType:
          options?.valueType !== undefined
            ? toProtoTableDataType(options.valueType)
            : undefined,
        format: toProtoOutputFormat(options?.format),
      },
      toCallOptions(options?.rpcCallOptions),
    );
    return new ResultStream<T>(rawStream);
  }
}

export type {
  Direction,
  FalloffPattern,
  MergePolicy,
  OutputFormat,
  PrimitiveValue,
  SpatialId,
  TableDataType,
  TableInfo,
  ZoomLevelPolicy,
} from "./convert.js";
export {
  isAlreadyExistsError,
  isKasaneError,
  isNotFoundError,
  isPermissionDeniedError,
  isUnauthenticatedError,
} from "./errors.js";
export type { DatabaseInfo } from "./gen/database_pb.js";
export {
  DatabaseHandle,
  TableHandle,
} from "./handle.js";
export {
  type FilterConditionInput,
  QueryBuilder,
  query,
} from "./query.js";
export type { RpcCallOptions } from "./rpcCallOptions.js";
export { type ResultItem, ResultStream } from "./stream.js";
