// Where each platform's Xcode project is, for React Native's own tooling
// (`pod install` asks it which native modules to link).
module.exports = {
  project: {
    ios: { sourceDir: "./apple/iOS" },
    macos: { sourceDir: "./apple/macOS" },
  },
};
