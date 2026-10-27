// Kasane の main の最新を取り直し、同じコミットから src/client/gen と src/client/wasm/gen を作る。
// 必要なもの: cargo（wasm32-unknown-unknown ターゲット）、protoc、Cargo.lock と同じ版の wasm-bindgen。
// wasm-opt があればサイズを縮める。

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { create, fromBinary } from "@bufbuild/protobuf";
import {
  CodeGeneratorRequestSchema,
  FileDescriptorSetSchema,
} from "@bufbuild/protobuf/wkt";
import { protocGenEs } from "@bufbuild/protoc-gen-es/dist/cjs/src/protoc-gen-es-plugin.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = join(root, "wasm", "Cargo.toml");
const genDir = join(root, "src", "client", "gen");
const wasmDir = join(root, "src", "client", "wasm", "gen");
const target = "wasm32-unknown-unknown";

function run(cmd: string[], options: { optional?: boolean } = {}): string {
  const result = Bun.spawnSync(cmd, { cwd: root, stderr: "inherit" });
  if (!result.success) {
    if (options.optional) return "";
    throw new Error(`failed: ${cmd.join(" ")}`);
  }
  return result.stdout.toString();
}

function has(cmd: string): boolean {
  return Bun.which(cmd) !== null;
}

run(["cargo", "update", "--manifest-path", manifest, "-p", "kasane"]);

type Package = { name: string; version: string; manifest_path: string };
const { packages } = JSON.parse(
  run([
    "cargo",
    "metadata",
    "--format-version",
    "1",
    "--manifest-path",
    manifest,
  ]),
) as { packages: Package[] };
const pkg = (name: string): Package => {
  const found = packages.find((p) => p.name === name);
  if (!found) throw new Error(`${name} is not in cargo metadata`);
  return found;
};

// codegen
const protoDir = join(dirname(pkg("kasane").manifest_path), "proto");
const protoFiles = [
  "auth.proto",
  "common.proto",
  "data.proto",
  "database.proto",
  "query.proto",
  "system.proto",
  "table.proto",
  "users.proto",
];
const descriptorPath = join(root, "wasm", "target", "kasane.protoset");
mkdirSync(dirname(descriptorPath), { recursive: true });
run([
  "protoc",
  `--proto_path=${protoDir}`,
  "--include_imports",
  "--include_source_info",
  `--descriptor_set_out=${descriptorPath}`,
  ...protoFiles,
]);
const response = protocGenEs.run(
  create(CodeGeneratorRequestSchema, {
    fileToGenerate: protoFiles,
    parameter: "target=ts",
    protoFile: fromBinary(FileDescriptorSetSchema, readFileSync(descriptorPath))
      .file,
  }),
);
if (response.error) throw new Error(response.error);
rmSync(genDir, { recursive: true, force: true });
for (const file of response.file) {
  const path = join(genDir, file.name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, file.content);
}

// wasm
const bindgenVersion = pkg("wasm-bindgen").version;
const cliVersion = has("wasm-bindgen")
  ? run(["wasm-bindgen", "--version"]).trim().split(" ")[1]
  : undefined;
if (cliVersion !== bindgenVersion) {
  throw new Error(
    `wasm-bindgen ${bindgenVersion} is required (found ${cliVersion ?? "none"}): cargo install wasm-bindgen-cli --version ${bindgenVersion}`,
  );
}
run([
  "cargo",
  "build",
  "--release",
  "--target",
  target,
  "--manifest-path",
  manifest,
]);
rmSync(wasmDir, { recursive: true, force: true });
// 既定の読み込み先（import.meta.url 基準）を使わないので、CJS に変換しても壊れない。
run([
  "wasm-bindgen",
  "--target",
  "web",
  "--omit-default-module-path",
  "--out-dir",
  wasmDir,
  "--out-name",
  "kasane",
  join(root, "wasm", "target", target, "release", "kasane_wasm.wasm"),
]);
const wasmPath = join(wasmDir, "kasane_bg.wasm");
if (has("wasm-opt")) {
  run(["wasm-opt", "-Oz", "--all-features", wasmPath, "-o", wasmPath]);
} else {
  console.warn("wasm-opt is not found; skipped size optimization");
}
// Workers は .wasm の import を WebAssembly.Module として渡すので、型もそれに合わせる。
writeFileSync(
  join(wasmDir, "kasane_bg.wasm.d.ts"),
  "declare const module: WebAssembly.Module;\nexport default module;\n",
);
writeFileSync(
  join(wasmDir, "kasane_bg.base64.ts"),
  `export default "${readFileSync(wasmPath).toString("base64")}";\n`,
);

const commit = readFileSync(join(root, "wasm", "Cargo.lock"), "utf8").match(
  /source = "git\+https:\/\/github\.com\/AirBee-Project\/Kasane\.git\?branch=main#(\w+)"/,
)?.[1];
console.log(`generated from Kasane ${pkg("kasane").version} (${commit})`);
