import fs from "node:fs";
import path from "node:path";

// CJS 向けの型定義エントリ (dist/index.d.cts) を生成
const dctsPath = path.resolve("dist/index.d.cts");
fs.writeFileSync(dctsPath, 'export * from "./index.js";\n', "utf-8");
