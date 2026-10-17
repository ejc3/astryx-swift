/**
 * Metro bundles the core from where it lives, `core/src`, two directories up. Nothing
 * is copied: the apps run the files the web page runs.
 */
const path = require("path");
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");

const repoRoot = path.resolve(__dirname, "../..");
const defaults = getDefaultConfig(__dirname);
// Under the React Native CLI this resolver reads `react-native` as `react-native-macos`
// for a macOS bundle; a `resolveRequest` of our own must call it.
const platformResolver = defaults.resolver.resolveRequest;

module.exports = mergeConfig(defaults, {
  watchFolders: [path.join(repoRoot, "core", "src")],
  resolver: {
    resolveRequest(context, moduleName, platform) {
      return (platformResolver ?? context.resolveRequest)(context, moduleName, platform);
    },
    // Files under core/ find this project's packages, and no others (core has none).
    nodeModulesPaths: [path.join(__dirname, "node_modules")],
  },
});
