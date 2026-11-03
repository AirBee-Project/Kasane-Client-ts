# Kasane-TypeScript
- 時空間IDの基礎的な型
- [Kasane v0.7](https://github.com/AirBee-Project/Kasane)との接続機能
- インメモリの Kasane（Wasm）

## import

モジュールごとのサブパスから import します。サブパスは API ドキュメントのモジュールと同じです。

| サブパス | 中身 |
| :--- | :--- |
| `@airbee-project/kasane-client/spatial-id` | `SingleId`、`RangeId`、`FlexId`、`Interval`、`SpatialIdError` |
| `@airbee-project/kasane-client/geometry` | `Coordinate`、`GeometryError` |
| `@airbee-project/kasane-client/client` | `KasaneClient`、通信エラーの判定関数 |
| `@airbee-project/kasane-client/client/database` | `DatabaseHandle`、`TableHandle`、テーブルの型 |
| `@airbee-project/kasane-client/client/query` | `query`、`QueryBuilder` |
| `@airbee-project/kasane-client/client/result` | `ResultStream` |

`spatial-id` と `geometry` は、Connect や Wasm を読み込みません。

## 接続

```ts
import { KasaneClient } from "@airbee-project/kasane-client/client";

// grpc-web で Kasane サーバーにつなぐ。複数の URL を渡すと、接続できないサーバーを飛ばす。
const client = await KasaneClient.connect("http://localhost:5172", "root", "password");

// プロセス内で動くインメモリの Kasane。データはこのクライアントだけが持ち、利用者は root 固定。
const local = await KasaneClient.inMemory();
```

`inMemory()` は Node、Bun、Deno、ブラウザ、Cloudflare Workers で動きます。Workers では Wrangler が `workerd` 条件で `.wasm` を別モジュールとして読み込み、それ以外の環境では JS に埋め込んだ Wasm を使います。

## 開発

```bash
bun install
bun run ci       # 型チェック、lint、テスト
bun run build
```

LMDB 版の Kasane サーバー（root のパスワードは `password`）を起動し、`KASANE_URL` に URL を渡すと、サーバーと Wasm 版で同じ操作の結果を比べるテストも動きます。

```bash
KASANE_URL=http://localhost:5172 bun run test
```

### 生成コードと Wasm の更新

`src/proto/gen`（proto から生成した TypeScript）と `src/client/wasm/gen`（Wasm）は、`wasm/Cargo.toml` が参照する Kasane の `main` から作ります。次のコマンドで `main` の最新を取り直し、同じコミットから両方を作り直します。使った Kasane のコミットは `wasm/Cargo.lock` に残ります。

```bash
bun run generate
```

必要なもの:

- cargo と `wasm32-unknown-unknown` ターゲット（`rustup target add wasm32-unknown-unknown`）
- protoc
- `wasm/Cargo.lock` と同じ版の wasm-bindgen-cli（違うとコマンドが版を示して止まります）
- wasm-opt（任意。あればサイズを縮めます）
