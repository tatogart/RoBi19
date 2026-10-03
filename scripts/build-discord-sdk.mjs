// Bundles Discord's Embedded App SDK into one browser file (public/vendor/discord-sdk.js).
// Inside a Discord Activity the page can't load scripts from other sites, so we serve it ourselves.
// Run again after updating @discord/embedded-app-sdk: node scripts/build-discord-sdk.mjs
import { build } from 'esbuild';

await build({
  stdin: { contents: "export { DiscordSDK, Events, patchUrlMappings } from '@discord/embedded-app-sdk';", resolveDir: process.cwd(), loader: 'js' },
  bundle: true, format: 'esm', minify: true, platform: 'browser', target: 'es2020',
  outfile: 'public/vendor/discord-sdk.js',
  legalComments: 'none',
});
console.log('public/vendor/discord-sdk.js built');
