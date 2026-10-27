import fs from "node:fs";
import path from "node:path";

const dist = path.resolve("dist");
const cjsDir = path.join(dist, "cjs");

// ルートの `"type": "module"` 配下にある `.d.ts` は ESM として解釈されるため、
// CJS 利用者 (`module: node16`) がそれを参照すると TS1479 になる。
// 同じ宣言を `"type": "commonjs"` のディレクトリへ複製し、CJS 用の型ツリーにする。
for (const file of fs.readdirSync(dist, { recursive: true })) {
  if (!file.endsWith(".d.ts") || file.startsWith(`cjs${path.sep}`)) continue;
  const dest = path.join(cjsDir, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(dist, file), dest);
}
fs.writeFileSync(
  path.join(cjsDir, "package.json"),
  `${JSON.stringify({ type: "commonjs" })}\n`,
);
