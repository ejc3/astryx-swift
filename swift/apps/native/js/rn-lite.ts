/**
 * The three things op-sqlite and the URL polyfill take from `react-native`, by their own paths.
 * Its index would bring every component into a bundle that draws nothing (metro.config.js sends
 * their imports here).
 */
import NativeModules from "react-native/Libraries/BatchedBridge/NativeModules";
import Platform from "react-native/Libraries/Utilities/Platform";
import * as TurboModuleRegistry from "react-native/Libraries/TurboModule/TurboModuleRegistry";

export { NativeModules, Platform, TurboModuleRegistry };
