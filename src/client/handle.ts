import {
  normalizeSpatialIds,
  type OutputFormat,
  type PrimitiveValue,
  type SpatialId,
  type TableDataType,
  toProtoOutputFormat,
  toProtoTableDataType,
  toProtoZoomLevelPolicy,
  toTypedValue,
  type ZoomLevelPolicy,
} from "./convert";
import type { TableConstraints } from "./gen/common_pb";
import type { DatabaseInfo } from "./gen/database_pb";
import type { TableInfo, TableSummary } from "./gen/table_pb";
import type { KasaneClient } from "./index";
import { type RpcCallOptions, toCallOptions } from "./rpcCallOptions";
import { ResultStream } from "./stream";

/**
 * 特定のテーブルに対する操作を行うスコープ付きハンドル。
 */
export class TableHandle<T extends PrimitiveValue = PrimitiveValue> {
  public readonly client: KasaneClient;
  public readonly dbName: string;
  public readonly tableName: string;

  constructor(client: KasaneClient, dbName: string, tableName: string) {
    this.client = client;
    this.dbName = dbName;
    this.tableName = tableName;
  }

  /** テーブルにデータを挿入する。既存データと重複がある場合はエラー。 */
  public async insert(
    value: T,
    ids: SpatialId | SpatialId[],
    policy?: ZoomLevelPolicy,
  ): Promise<void> {
    await this.client.data.insert({
      dbName: this.dbName,
      tableName: this.tableName,
      value: toTypedValue(value),
      spatialIds: normalizeSpatialIds(ids),
      zoomLevelPolicy: toProtoZoomLevelPolicy(policy),
    });
  }

  /** テーブルにデータを更新または挿入する。 */
  public async upsert(
    value: T,
    ids: SpatialId | SpatialId[],
    policy?: ZoomLevelPolicy,
  ): Promise<void> {
    await this.client.data.upsert({
      dbName: this.dbName,
      tableName: this.tableName,
      value: toTypedValue(value),
      spatialIds: normalizeSpatialIds(ids),
      zoomLevelPolicy: toProtoZoomLevelPolicy(policy),
    });
  }

  /** テーブルから指定された空間IDのデータを削除する。 */
  public async remove(
    ids: SpatialId | SpatialId[],
    policy?: ZoomLevelPolicy,
  ): Promise<void> {
    await this.client.data.remove({
      dbName: this.dbName,
      tableName: this.tableName,
      spatialIds: normalizeSpatialIds(ids),
      zoomLevelPolicy: toProtoZoomLevelPolicy(policy),
    });
  }

  /** 指定された空間IDに合致するデータを検索する。 */
  public search(
    ids: SpatialId | SpatialId[],
    options?: {
      policy?: ZoomLevelPolicy;
      format?: OutputFormat;
      rpcCallOptions?: RpcCallOptions;
    },
  ): ResultStream<T> {
    const rawStream = this.client.data.search(
      {
        dbName: this.dbName,
        tableName: this.tableName,
        spatialIds: normalizeSpatialIds(ids),
        zoomLevelPolicy: toProtoZoomLevelPolicy(options?.policy),
        format: toProtoOutputFormat(options?.format),
      },
      toCallOptions(options?.rpcCallOptions),
    );
    return new ResultStream<T>(rawStream);
  }

  /** テーブルの詳細情報を取得する。 */
  public async info(): Promise<TableInfo> {
    return await this.client.tableClient.get({
      dbName: this.dbName,
      tableName: this.tableName,
    });
  }

  /** テーブルを削除する。 */
  public async delete(): Promise<void> {
    await this.client.tableClient.delete({
      dbName: this.dbName,
      tableName: this.tableName,
    });
  }

  /** テーブルを複製する。 */
  public async copy(
    copyTableName: string,
    copyDbName?: string,
  ): Promise<TableSummary> {
    return await this.client.tableClient.copy({
      dbName: this.dbName,
      tableName: this.tableName,
      copyDbName,
      copyTableName,
    });
  }
}

/**
 * 特定のデータベースに対する操作を行うスコープ付きハンドル。
 */
export class DatabaseHandle {
  public readonly client: KasaneClient;
  public readonly name: string;

  constructor(client: KasaneClient, name: string) {
    this.client = client;
    this.name = name;
  }

  /** 配下のテーブルハンドルを取得する。 */
  public table<T extends PrimitiveValue = PrimitiveValue>(
    tableName: string,
  ): TableHandle<T> {
    return new TableHandle<T>(this.client, this.name, tableName);
  }

  /** データベースの詳細情報を取得する。 */
  public async info(): Promise<DatabaseInfo> {
    return await this.client.databaseClient.get({ dbName: this.name });
  }

  /** データベースと配下のテーブルを削除する。 */
  public async delete(): Promise<void> {
    await this.client.databaseClient.delete({ dbName: this.name });
  }

  /** データベースの名前または説明文を更新する。 */
  public async update(options: {
    newName?: string;
    description?: string | null;
  }): Promise<void> {
    const descriptionUpdate: Parameters<
      typeof this.client.databaseClient.update
    >[0]["descriptionUpdate"] =
      options.description === null
        ? { case: "clearDescription", value: true }
        : options.description !== undefined
          ? { case: "setDescription", value: options.description }
          : { case: undefined };

    await this.client.databaseClient.update({
      dbName: this.name,
      newName: options.newName,
      descriptionUpdate,
    });
  }

  /** データベースを複製する。 */
  public async copy(copyName: string): Promise<DatabaseInfo> {
    return await this.client.databaseClient.copy({
      dbName: this.name,
      copyName,
    });
  }

  /** テーブル一覧を取得する。 */
  public async listTables(options?: {
    rpcCallOptions?: RpcCallOptions;
  }): Promise<TableSummary[]> {
    const res = await this.client.tableClient.list(
      { dbName: this.name },
      toCallOptions(options?.rpcCallOptions),
    );
    return res.tables;
  }

  /** テーブルを新規作成する。 */
  public async createTable(
    name: string,
    dataType: TableDataType,
    maxZoomLevel: number,
    options?: {
      constraints?: TableConstraints;
      description?: string;
      valueIndex?: boolean;
      isTemporal?: boolean;
    },
  ): Promise<TableSummary> {
    return await this.client.tableClient.create({
      dbName: this.name,
      name,
      dataType: toProtoTableDataType(dataType),
      maxZoomLevel,
      constraints: options?.constraints,
      description: options?.description,
      valueIndex: options?.valueIndex ?? false,
      isTemporal: options?.isTemporal ?? false,
    });
  }
}
