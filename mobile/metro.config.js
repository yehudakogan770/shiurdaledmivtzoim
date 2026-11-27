// The site's one-file copy (assets/site/app.html) is packed into the app as a plain file.
const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("html");
module.exports = config;
