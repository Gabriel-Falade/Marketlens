// Stub module — used by Metro on web to replace react-native-maps.
// map.tsx is never executed on web (map.web.tsx takes over),
// but Metro still needs to be able to parse and bundle the file.
const noop = () => null;

module.exports = {
  __esModule: true,
  default:         noop,
  MapView:         noop,
  Marker:          noop,
  Callout:         noop,
  Circle:          noop,
  Polygon:         noop,
  Polyline:        noop,
  Heatmap:         noop,
  PROVIDER_GOOGLE: null,
  PROVIDER_DEFAULT: null,
  MAP_TYPES:       {},
};
