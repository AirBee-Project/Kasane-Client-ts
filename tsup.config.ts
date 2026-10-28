import { execSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "wasm/inline": "src/client/wasm/inline.ts",
    "wasm/workerd": "src/client/wasm/workerd.ts",
  },
  format: ["esm", "cjs"],
  // `#kasane-wasm` は実行環境に合わせて package.json の imports で選ぶので、束ねない。
  // `.wasm` は Workers のバンドラーに WebAssembly.Module として読ませるため、ファイルのまま置く。
  external: ["#kasane-wasm", /\.wasm$/],
  dts: false,
  sourcemap: true,
  clean: true,
  onSuccess: async () => {
    mkdirSync("dist/wasm/gen", { recursive: true });
    copyFileSync(
      "src/client/wasm/gen/kasane_bg.wasm",
      "dist/wasm/gen/kasane_bg.wasm",
    );
    execSync("bun x tsc --project tsconfig.build.json", { stdio: "inherit" });
    execSync("bun scripts/postbuild.js", { stdio: "inherit" });
  },
});
