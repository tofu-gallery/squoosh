#!/usr/bin/env node
/*
 * Tofu gallery packaging for Squoosh. This file is an addition of the
 * tofu-gallery fork (branch `tofu`); it is not part of upstream Squoosh.
 *
 * It builds the app with upstream's own `npm run build` (Rollup, output in
 * build/), then copies the finished static site into site/, which the `tofu`
 * branch commits so a copy can be served as plain static files with no build
 * step. It leaves out upstream's `_headers` and `_redirects` (see below) and
 * adds a "Source code" row to the page. It also copies the licence files into
 * site/licenses/ and fails if a known analytics or tracking endpoint is found
 * in the published files.
 *
 * Usage, from the repository root after `npm ci`:
 *   node scripts/tofu-build.mjs              build, then package site/
 *   node scripts/tofu-build.mjs --skip-build package an existing build/
 */
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = join(root, 'build');
const siteDir = join(root, 'site');

// Where the source of this site is: this fork at the gallery pin's tag (a
// commit cannot name its own hash, so the tag names it). The page's "Source
// code" link and licenses/README.txt both point here. If you change the code,
// point this at the source of your own version before you publish it.
const sourceTag = 'pin/2026-10-24';
const sourceUrl = `https://github.com/tofu-gallery/squoosh/tree/${sourceTag}`;

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed (exit ${result.status ?? result.signal})`,
    );
  }
}

function filesUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

function insertOnce(text, anchor, addition, { after }) {
  const at = text.indexOf(anchor);
  if (at === -1 || text.indexOf(anchor, at + 1) !== -1) {
    throw new Error(`index.html should contain ${anchor} exactly once`);
  }
  const index = after ? at + anchor.length : at;
  return text.slice(0, index) + addition + text.slice(index);
}

if (!process.argv.includes('--skip-build')) run('npm', ['run', 'build']);
if (!existsSync(join(buildDir, 'index.html'))) {
  throw new Error('build/index.html is missing: the upstream build did not finish');
}

rmSync(siteDir, { recursive: true, force: true });
cpSync(buildDir, siteDir, { recursive: true });

// Upstream's build also writes `_headers` (COOP/COEP and no-cache) and
// `_redirects` (/editor to /). Tofu's Free static plan refuses a whole site
// that contains either file, so they are not published. Without them the page
// is not cross-origin isolated and Squoosh uses its single-threaded codecs by
// itself, and its service worker performs the /editor redirect.
for (const name of ['_headers', '_redirects']) {
  rmSync(join(siteDir, name), { force: true });
}

// 2026-10-24: the "Reduce palette" codec, libimagequant, is GPL-3.0, so the
// people who open the page must be offered its source. index.html gets a
// "Source code" row above the app, shown before anything is clicked. The row
// sits outside #app, which Preact renders over, and #app is shortened to the
// space below it, so the row covers none of the app's controls. The link opens
// a new tab, so an image being edited stays open, and an image file dropped on
// the row is ignored instead of replacing the app in the tab (the rest of the
// page is the app's own drop area). The file also gets the dated notice
// Apache-2.0 section 4(b) asks for. A page that already has the row gets it
// replaced, so running this twice gives the same file.
const indexFile = join(siteDir, 'index.html');
let page = readFileSync(indexFile, 'utf8')
  .replace(/<!-- MODIFIED FILE NOTICE[\s\S]*?-->/, '')
  .replace(/<style id="tofu-source-style">[\s\S]*?<\/style>/, '')
  .replace(/<aside id="tofu-source"[\s\S]*?<\/aside>/, '');
page = insertOnce(
  page,
  '<!DOCTYPE html>',
  '<!-- MODIFIED FILE NOTICE (Apache License 2.0, section 4(b)): this file was ' +
    'changed on 2026-10-24 for the Tofu gallery copy ' +
    '(github.com/tofu-gallery/squoosh, branch tofu). scripts/tofu-build.mjs ' +
    'adds the "Source code" row above the app and the styles that make room ' +
    'for it. See TOFU.md. -->',
  { after: true },
);
page = insertOnce(
  page,
  '</head>',
  '<style id="tofu-source-style">' +
    'body{display:flex;flex-direction:column}' +
    '#app{position:relative;flex:1 1 0;height:auto;min-height:0}' +
    '#tofu-source{flex:none;padding:6px 12px;background:#1d1d1d;color:#d1d1d1;' +
    'font-size:13px;line-height:18px}' +
    '#tofu-source a{margin-right:8px;color:#fff;font-weight:700;' +
    'text-decoration:underline}' +
    '#tofu-source a:focus-visible{outline:2px solid #76c8ff;outline-offset:2px}' +
    '</style>',
  { after: false },
);
page = insertOnce(
  page,
  '<body>',
  '<aside id="tofu-source" aria-label="Source code" ' +
    'ondragover="event.preventDefault()" ondrop="event.preventDefault()">' +
    `<a href="${sourceUrl}" target="_blank" rel="noopener">Source code</a> ` +
    '<span>The source includes the GPL-licensed palette codec ' +
    '(libimagequant).</span></aside>',
  { after: true },
);
writeFileSync(indexFile, page);

// Licences travel with every published copy: upstream's Apache-2.0 LICENSE
// (byte-identical) and the licence files upstream ships for its codecs.
const licensesDir = join(siteDir, 'licenses');
mkdirSync(licensesDir);
cpSync(join(root, 'LICENSE'), join(licensesDir, 'squoosh-LICENSE.txt'));
const codecLicences = [];
for (const codec of readdirSync(join(root, 'codecs')).sort()) {
  const licence = join(root, 'codecs', codec, 'LICENSE.codec.md');
  if (!existsSync(licence)) continue;
  cpSync(licence, join(licensesDir, `codec-${codec}-LICENSE.txt`));
  codecLicences.push(codec);
}
writeFileSync(
  join(licensesDir, 'README.txt'),
  `Squoosh - licences and source

This site is a build of Squoosh, https://github.com/GoogleChromeLabs/squoosh
Copyright 2020 Google Inc., licensed under the Apache License, Version 2.0
(squoosh-LICENSE.txt). It was built from the tofu-gallery copy,
https://github.com/tofu-gallery/squoosh (branch "tofu"; each gallery pin is a
"pin/<date>" tag), which removes Google Analytics and adds the page's "Source
code" link; see TOFU.md there.

The image codecs are third-party projects compiled to WebAssembly. Upstream
ships licence files for ${codecLicences.join(', ')}; they are copied here as
codec-<name>-LICENSE.txt. The other codecs are built from the projects named in
codecs/<name>/ of the source repository, under those projects' own licences.

The "Reduce palette" option uses libimagequant 2.12.1, licensed under the GNU
GPL version 3 or later (codec-imagequant-LICENSE.txt). Its corresponding source
is codecs/imagequant/ at the tag ${sourceTag} of the source repository,
${sourceUrl}
which the page's "Source code" link opens. It builds libimagequant 2.12.1 from
https://github.com/ImageOptim/libimagequant/archive/2.12.1.tar.gz
`,
);

// Guard: this copy must not load analytics or tracking scripts.
const banned = [
  /google-analytics\.com/,
  /googletagmanager\.com/,
  /UA-128752250/,
];
const textTypes = new Set(['.html', '.js', '.css', '.json', '.webmanifest']);
const offenders = filesUnder(siteDir).filter((file) => {
  const name = relative(siteDir, file);
  if (!textTypes.has(extname(file)) && !name.startsWith('_')) return false;
  const text = readFileSync(file, 'utf8');
  return banned.some((pattern) => pattern.test(text));
});
if (offenders.length) {
  throw new Error(
    `Tracking endpoint found in: ${offenders
      .map((file) => relative(root, file))
      .join(', ')}`,
  );
}

const files = filesUnder(siteDir);
console.log(
  `tofu-build: site/ is ready (${files.length} files, index.html present with the source link, no tracking endpoints found)`,
);
