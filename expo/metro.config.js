const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);
const rorkConfig = withRorkMetro(config);
const rorkResolve = rorkConfig.resolver.resolveRequest;

// Native-only packages that need web stubs
const WEB_POLYFILLS = {
  "expo-sensors": path.resolve(__dirname, "web-polyfills/expo-sensors.web.js"),
  "expo-av":      path.resolve(__dirname, "web-polyfills/expo-av.web.js"),
};

rorkConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && WEB_POLYFILLS[moduleName]) {
    return { filePath: WEB_POLYFILLS[moduleName], type: "sourceFile" };
  }
  return rorkResolve(context, moduleName, platform);
};

module.exports = rorkConfig;
