const fs = require('fs');
const path = require('path');
const {parse} = require('es-module-lexer');
const {minify: minifyCss} = require('csso');

/** Early-exit function that determines, given a set of JS files, if CSS is being imported */
function hasCSSImport(files) {
  for (const file of files) {
    const code = fs.readFileSync(file, 'utf-8');
    const [imports] = parse(code);
    for (const {s, e} of imports.filter(({d}) => d === -1)) {
      const spec = code.substring(s, e);
      if (spec.endsWith('.css.proxy.js')) return true; // exit as soon as we find one
    }
  }
  return false;
}
exports.hasCSSImport = hasCSSImport;

/**
 * Scans JS for CSS imports, and embeds only what’s needed
 *
 * import 'global.css'                       -> (removed; loaded in HTML)
 * import url from 'global.css'              -> const url = 'global.css'
 * import {foo, bar} from 'local.module.css' -> const {foo, bar} = 'local.module.css'
 */
function embedStaticCSS(file, code) {
  const cssImports = new Set();
  const proxyImports = new Set();
  const filePath = path.dirname(file);
  let newCode = code;

  const [imports] = parse(code);
  imports
    .filter(({d}) => d === -1) // this is where we discard dynamic imports (> -1) and import.meta (-2)
    .filter(({s, e}) => code.substring(s, e).endsWith('.css.proxy.js'))
    .forEach(({ss, se, s, e}) => {
      const originalImport = code.substring(s, e);
      const importedFile = originalImport.replace(/\.proxy\.js$/, '');
      cssImports.add(path.resolve(filePath, importedFile));
      proxyImports.add(path.resolve(filePath, originalImport));

      const importNamed = code
        .substring(ss, se)
        .replace(code.substring(s - 1, e + 1), '') // remove import
        .replace(/^import\s+/, '') // remove keyword
        .replace(/\s*from.*$/, '') // remove other keyword
        .replace(/\*\s+as\s+/, '') // sanitize star imports
        .trim();

      // transform JS

      // option 1: no transforms needed
      if (!importNamed) {
        newCode = newCode.replace(new RegExp(`${code.substring(ss, se)};?\n?`), '');
        return;
      }

      if (importedFile.endsWith('.module.css')) {
        // option 2: transform css modules
        const proxyCode = fs.readFileSync(path.resolve(filePath, originalImport), 'utf-8');
        const matches = proxyCode.match(/^let json\s*=\s*(\{[^\}]+\})/m);
        if (!matches) return;
        newCode = newCode.replace(
          new RegExp(`${code.substring(ss, se).replace(/\*/g, '\\*')};?`),
          `const ${importNamed.replace(/\*\s+as\s+/, '')} = ${matches[1]}`,
        );
      } else {
        // option 3: transfrom normal css
        newCode = newCode.replace(
          new RegExp(`${code.substring(ss, se)};?`),
          `const ${importNamed} = '${importedFile}'`,
        );
      }
    });

  return {cssImports, proxyImports, code: newCode};
}
exports.embedStaticCSS = embedStaticCSS;

/** Build CSS File */
function concatAndMinifyCSS(manifest) {
  let css = '';
  let importedFiles = new Set();
  if (!manifest.css) return;
  Object.values(manifest.css).forEach((file) => {
    file.css.forEach((cssFile) => {
      if (!importedFiles.has(cssFile)) return; // don’t load CSS twice!
      css += '\n' + fs.readFileSync(cssFile, 'utf-8');
      importedFiles.add(cssFile);
    });
  });
  return minifyCss(css).css;
}
exports.concatAndMinifyCSS = concatAndMinifyCSS;

/** Remove .css.proxy.js files (that were imported) */
function removeCSSProxyFiles(manifest) {
  Object.values(manifest.css).forEach((file) => {
    file.proxy.forEach((proxy) => {
      if (fs.existsSync(proxy)) fs.unlinkSync(proxy);
    });
  });
}
exports.removeCSSProxyFiles = removeCSSProxyFiles;
