const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// ── Native-only module stubs for web ─────────────────────────────────────────
// Metro bundles every file in app/ regardless of platform. When it encounters
// map.tsx (which imports react-native-maps) while building for web, it fails
// because react-native-maps uses native-only internals.
//
// This resolver intercepts those imports on the web platform and redirects them
// to lightweight stubs. The stubs export null/noop so the bundle can be parsed.
// map.web.tsx is the actual route used at runtime — map.tsx never executes.

const WEB_STUBS = {
  'react-native-maps': path.resolve(__dirname, 'web-stubs/react-native-maps.js'),
};

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && WEB_STUBS[moduleName]) {
    return { type: 'sourceFile', filePath: WEB_STUBS[moduleName] };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
