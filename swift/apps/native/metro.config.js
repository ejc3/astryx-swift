/**
 * Metro bundles the core and the sync layer from where they live, `core/src` and `sync/src`,
 * two directories up. Nothing is copied: the apps run the files the web page and the server run.
 */
const path = require("path");
const { realpathSync } = require("node:fs");
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");

const repoRoot = path.resolve(__dirname, "../..");
const defaults = getDefaultConfig(__dirname);
// Under the React Native CLI this resolver reads `react-native` as `react-native-macos`
// for a macOS bundle; a `resolveRequest` of our own must call it.
const platformResolver = defaults.resolver.resolveRequest;

/** The repository's own packages, by the names they import each other with: their sources. */
const WORKSPACE = {
  "@astryx-native/core": path.join(repoRoot, "core", "src", "index.ts"),
  "@astryx-native/sync": path.join(repoRoot, "sync", "src", "index.ts"),
  "@astryx-native/sync/client": path.join(repoRoot, "sync", "src", "client.ts"),
  "@astryx-native/sync/host": path.join(repoRoot, "sync", "src", "host.ts"),
};
const SOURCES = [path.join(repoRoot, "core", "src"), path.join(repoRoot, "sync", "src")].map((d) => d + path.sep);
/** op-sqlite and the URL polyfill ask for `react-native`'s index, which names every component; they need three modules of it. */
const RN_LITE = path.join(__dirname, "js", "rn-lite.ts");
const LITE_USERS = [["@op-engineering", "op-sqlite"], ["react-native-url-polyfill"]].map((p) => realpathSync(path.join(__dirname, "node_modules", ...p)) + path.sep);

module.exports = mergeConfig(defaults, {
  watchFolders: [path.join(repoRoot, "core", "src"), path.join(repoRoot, "sync", "src")],
  resolver: {
    resolveRequest(context, moduleName, platform) {
      const resolve = platformResolver ?? context.resolveRequest;
      if (WORKSPACE[moduleName]) return { type: "sourceFile", filePath: WORKSPACE[moduleName] };
      if (moduleName === "react-native" && LITE_USERS.some((d) => context.originModulePath.startsWith(d))) return { type: "sourceFile", filePath: RN_LITE };
      // Files under core/ and sync/ find this project's packages (the versions it pins), as if
      // imported from here, never a copy installed elsewhere in the repository.
      if (!moduleName.startsWith(".") && SOURCES.some((d) => context.originModulePath.startsWith(d)))
        return resolve({ ...context, originModulePath: path.join(__dirname, "js", "index.ts") }, moduleName, platform);
      return resolve(context, moduleName, platform);
    },
    nodeModulesPaths: [path.join(__dirname, "node_modules")],
  },
});
