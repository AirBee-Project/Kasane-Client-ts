import { type Client, createClient } from "@connectrpc/connect";
import { createGrpcWebTransport } from "@connectrpc/connect-web";
import { createAuthInterceptor } from "./auth";
import {
  normalizeSpatialIds,
  type OutputFormat,
  type SpatialId,
  type TableDataType,
  toProtoOutputFormat,
  toProtoTableDataType,
} from "./convert";
import { FailoverTransport } from "./failoverTransport";
import { AuthService } from "./gen/auth_pb";
import { DataService } from "./gen/data_pb";
import type { DatabaseInfo } from "./gen/database_pb";
import { DatabaseService } from "./gen/database_pb";
import type { QueryNode } from "./gen/query_pb";
import { QueryService } from "./gen/query_pb";
import { TableService } from "./gen/table_pb";
import { DatabaseHandle } from "./handle";
import { QueryBuilder } from "./query";
import { type RpcCallOptions, toCallOptions } from "./rpcCallOptions";
import { ResultStream } from "./stream";

/**
 * Kasaneに接続するクライアント。
 */
export class KasaneClient {
  /** @internal */
  public readonly auth: Client<typeof AuthService>;
  /** @internal */
  public readonly databaseClient: Client<typeof DatabaseService>;
  /** @internal */
  public readonly tableClient: Client<typeof TableService>;
  /** @internal */
  public readonly data: Client<typeof DataService>;
  /** @internal */
  private readonly queryClient: Client<typeof QueryService>;

  private token: string | undefined;

  private constructor(
    servers: string[],
    onTokenExpired?: () => Promise<string | undefined>,
  ) {
    if (servers.length === 0) {
      throw new Error("KasaneClient requires at least one server URL");
    }

    const transport = new FailoverTransport(
      servers.map((baseUrl) =>
        createGrpcWebTransport({
          baseUrl,
          interceptors: [
            createAuthInterceptor({
              getToken: () => this.token,
              refreshToken: onTokenExpired,
            }),
          ],
        }),
      ),
    );

    this.auth = createClient(AuthService, transport);
    this.databaseClient = createClient(DatabaseService, transport);
    this.tableClient = createClient(TableService, transport);
    this.data = createClient(DataService, transport);
    this.queryClient = createClient(QueryService, transport);
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

    const client: KasaneClient = new KasaneClient(
      serverList,
      async (): Promise<string | undefined> => {
        const res = await client.auth.login({ username, password });
        client.token = res.token;
        return res.token;
      },
    );

    const res = await client.auth.login({ username, password });
    client.token = res.token;
    return client;
  }

  /** 保持しているトークンを破棄する。以降の呼び出しは未認証状態になる。 */
  public logout(): void {
    this.token = undefined;
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
  ZoomLevelPolicy,
} from "./convert";
export {
  isAlreadyExistsError,
  isKasaneError,
  isNotFoundError,
  isPermissionDeniedError,
  isUnauthenticatedError,
} from "./errors";
export type { DatabaseInfo } from "./gen/database_pb";
export type { TableInfo, TableSummary } from "./gen/table_pb";
export {
  DatabaseHandle,
  TableHandle,
} from "./handle";
export {
  type FilterConditionInput,
  QueryBuilder,
  query,
} from "./query";
export type { RpcCallOptions } from "./rpcCallOptions";
export { type ResultItem, ResultStream } from "./stream";
