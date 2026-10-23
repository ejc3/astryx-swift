module.exports = {
  presets: ["module:@react-native/babel-preset"],
  // Zero's dependencies use class static blocks, which the preset leaves to the engine and Hermes lacks.
  plugins: ["@babel/plugin-transform-class-static-block"],
};
