/**
 * Copy/paste from Snowpack utils, at least until there’s some common import
 */
const path = require('path');

/** determine if remote package or not */
function isRemoteModule(specifier) {
  return (
    specifier.startsWith('//') ||
    specifier.startsWith('http://') ||
    specifier.startsWith('https://')
  );
}
exports.isRemoteModule = isRemoteModule;

/** URL relative */
function relativeURL(path1, path2) {
  let url = path.relative(path1, path2).replace(/\\/g, '/');
  if (!url.startsWith('./') && !url.startsWith('../')) {
    url = './' + url;
  }
  return url;
}
exports.relativeURL = this.relativeURL;

/** Remove \ and / from beginning of string */
exports.removeLeadingSlash = function removeLeadingSlash(path) {
  return path.replace(/^[/\\]+/, '');
};

/** Build Manifest */
function buildManifest({buildDirectory, hasCSSImport, manifest}) {
  const manifestURL = (filepath) => relativeURL(buildDirectory, filepath).replace(/^\./, '');

  // assemble CSS
  if (hasCSSImport && manifest.css) {
    const manifestCSS = Object.entries(manifest.css).map(([k, v]) => {
      const css = v.css.map(manifestURL);
      const proxy = v.proxy.map(manifestURL);
      css.sort((a, b) => a.localeCompare(b));
      proxy.sort((a, b) => a.localeCompare(b));
      return [manifestURL(k), {css, proxy}];
    });
    manifestCSS.sort((a, b) => a[0].localeCompare(b[0]));
    manifest.css = Object.fromEntries(manifestCSS);
  }

  return manifest;
}
exports.buildManifest = buildManifest;
