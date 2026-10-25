#!/usr/bin/env node
/**
 * Builds the JavaScript bundle the apps load: `build/main.jsbundle`, or the path given.
 * Metro bundles js/index.ts with the core from core/src, then Hermes compiles it to
 * bytecode so the app does not parse it at each launch. `--platform=ios` bundles
 * react-native's files (the default is the Mac's, react-native-macos), `--source` leaves
 * it as JavaScript. A build product, never committed.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const asSource = args.includes("--source");
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const platform = option("platform") ?? "macos";
if (platform !== "macos" && platform !== "ios") {
  console.error(`--platform is macos or ios, not ${platform}`);
  process.exit(2);
}
const output = resolve(args.find((arg) => !arg.startsWith("--")) ?? join(root, "build", "main.jsbundle"));
const require = createRequire(join(root, "package.json"));

mkdirSync(dirname(output), { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), "astryx-bundle-"));
const source = join(scratch, "bundle.js");
try {
  execFileSync(process.execPath, [
    require.resolve("react-native/cli.js"), "bundle",
    "--platform", platform, "--dev", "false", "--minify", "false",
    "--entry-file", "js/index.ts", "--bundle-output", source,
    "--assets-dest", join(dirname(output), "assets"), "--reset-cache",
  ], { cwd: root, stdio: "inherit" });
  if (asSource) copyFileSync(source, output);
  else {
    const hostRequire = createRequire(require.resolve(platform === "macos" ? "react-native-macos/package.json" : "react-native/package.json"));
    const hermesc = join(dirname(hostRequire.resolve("hermes-compiler/package.json")), "hermesc", "osx-bin", "hermesc");
    execFileSync(hermesc, ["-O", "-emit-binary", "-out", output, source], { stdio: "inherit" });
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
console.log(`${output}: ${statSync(output).size} bytes${asSource ? "" : " of Hermes bytecode"}`);
