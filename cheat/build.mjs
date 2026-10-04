// Makes the bookmarklet and the userscript from cheat/robis-cheat.js:
//   node cheat/build.mjs
import fs from 'node:fs';
import * as esbuild from 'esbuild';
const src = fs.readFileSync(new URL('./robis-cheat.js', import.meta.url), 'utf8');
const min = (await esbuild.transform(src, { minify: true, target: 'es2020' })).code.trim();
fs.writeFileSync(new URL('./bookmarklet.txt', import.meta.url), 'javascript:' + encodeURIComponent(min).replace(/'/g, '%27') + '\n');
fs.writeFileSync(new URL('./robis-cheat.user.js', import.meta.url), `// ==UserScript==
// @name         Robis Test Cheat
// @description  For testing the Robis anti-cheat and Overwatch (branch claude/robis-test-cheat)
// @version      1.0
// @match        *://*/play*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
${src}`);
console.log('bookmarklet:', min.length, 'chars');
