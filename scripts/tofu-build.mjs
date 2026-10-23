#!/usr/bin/env node
/*
 * Tofu gallery packaging for Squoosh. This file is an addition of the
 * tofu-gallery fork (branch `tofu`); it is not part of upstream Squoosh.
 *
 * It builds the app with upstream's own `npm run build` (Rollup, output in
 * build/), then copies the finished static site into site/, which the `tofu`
 * branch commits so a copy can be served as plain static files with no build
 * step. It also copies the licence files into site/licenses/ and fails if a
 * known analytics or tracking endpoint is found in the published files.
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

if (!process.argv.includes('--skip-build')) run('npm', ['run', 'build']);
if (!existsSync(join(buildDir, 'index.html'))) {
  throw new Error('build/index.html is missing: the upstream build did not finish');
}

rmSync(siteDir, { recursive: true, force: true });
cpSync(buildDir, siteDir, { recursive: true });

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
"pin/<date>" tag), which removes Google Analytics; see TOFU.md there.

The image codecs are third-party projects compiled to WebAssembly. Upstream
ships licence files for ${codecLicences.join(', ')}; they are copied here as
codec-<name>-LICENSE.txt. The other codecs are built from the projects named in
codecs/<name>/ of the source repository, under those projects' own licences.

The "Reduce palette" option uses libimagequant 2.12.1, licensed under the GNU
GPL version 3 or later (codec-imagequant-LICENSE.txt). Its corresponding source
is codecs/imagequant/ in the source repository above, which builds
libimagequant 2.12.1 from
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
  `tofu-build: site/ is ready (${files.length} files, index.html present, no tracking endpoints found)`,
);
