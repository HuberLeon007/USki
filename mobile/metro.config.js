// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Ensure .mjs modules (e.g. lucide-react-native's icon submodules) resolve on
// every platform, including Metro web in this environment.
if (!config.resolver.sourceExts.includes("mjs")) {
  config.resolver.sourceExts.push("mjs");
}

module.exports = config;
