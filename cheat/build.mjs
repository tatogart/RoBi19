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
// the short one, for phones
const lite = (await esbuild.transform(fs.readFileSync(new URL('./robis-cheat-lite.js', import.meta.url), 'utf8'), { minify: true, target: 'es2020' })).code.trim();
// only the characters a bookmark needs escaped: it stays short and readable
const liteUrl = 'javascript:' + lite.replace(/%/g, '%25').replace(/#/g, '%23').replace(/\n/g, ' ');
fs.writeFileSync(new URL('./bookmarklet-lite.txt', import.meta.url), liteUrl + '\n');
console.log('lite bookmarklet:', liteUrl.length, 'chars');
