# Squoosh on Tofu

Squoosh is Google Chrome Labs' image compressor that runs entirely in the browser. You open, drop or paste an image, or pick one of the bundled demo images. You then choose an encoder (MozJPEG, WebP, AVIF, JPEG XL, WebP v2, OxiPNG, QOI or the browser's own JPEG/PNG/GIF) and adjust quality, resizing and palette reduction. The original and the result are compared side by side, and you download the smaller file. The codecs are WebAssembly running in web workers, so images never leave the browser. There is no account, application server or database.

## Running a copy

- **Tofu framework preset:** `static`.
- **Site/import root: `site/`.** Import or deploy only this subfolder of the pinned commit. It contains `index.html` and every compiled asset. Do not use the static preset on the repository root: its upstream `package.json` declares a Rollup build that no Tofu preset runs.
- **Build command when deploying:** none. **Output directory:** `site/`, committed on the `tofu` branch.
- **Environment variables:** none, at build time or at runtime. No key, Tofu account or third-party account is involved.
- **Database:** none. Images are processed in memory and never uploaded. The browser stores only three things: encoder settings a person saves with a side's save-settings button (`localStorage`), a small IndexedDB flag that tells the service worker to pre-cache the codecs, and the service worker's own caches. All of it stays in that browser, for that address.
- **Serve at the host's root `/`, not under a path prefix.** The build uses root-relative URLs such as `/c/…`, `/manifest.json` and `/serviceworker.js`.
- **HTTPS**, which Tofu provides, is what the offline service worker, installing as an app and pasting images from the clipboard rely on.
- **No `_headers` or `_redirects` in `site/`.** Upstream's build writes both next to `index.html`: `_headers` sets `Cache-Control: no-cache` and the `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` pair, and `_redirects` sends `/editor` to `/`. Tofu's Free plan refuses a whole site for either file, so both are left out and the page is served without those headers. It is therefore not cross-origin isolated, and Squoosh uses its single-threaded AVIF, JPEG XL and WebP v2 encoders and OxiPNG by itself, which are slower than the multi-threaded ones. MozJPEG, AVIF, WebP and OxiPNG were checked that way (see below). Once the service worker is installed it performs the `/editor` to `/` redirect; a first visit to the old `/editor` address, before it is installed, is not redirected. A host that can send response headers can bring the multi-threaded codecs back by sending the two COOP/COEP headers listed in `serve.json`.

## What we changed and why

1. **Removed Google Analytics** from `src/client/initial-app/index.tsx`. Upstream created a Universal Analytics tracker (`UA-128752250-1`), sent a pageview and loaded `https://www.google-analytics.com/analytics.js`; other modules sent events for app installs and the before/after sizes of downloads. Gallery copies must not carry tracking, so the setup is gone. `window.ga` is now a no-op, so those event calls do nothing, and nothing is queued, loaded or sent. The file starts with a modification notice, as Apache-2.0 section 4(b) asks. This is the only upstream file changed.
2. **Added `scripts/tofu-build.mjs` and the prebuilt `site/`.** The script runs upstream's own `npm run build` and copies `build/` into `site/`, leaving out upstream's `_headers` and `_redirects` (item 3). It also copies the licence files into `site/licenses/` and fails if a known analytics endpoint appears in the published files. The codecs are committed upstream as compiled WebAssembly, so no Rust, C++ or Docker toolchain is needed.
3. **Removed `site/_headers` and `site/_redirects`.** Tofu's Free plan serves a finished site only when every file in it is a type its static hosting serves and none looks like build or server configuration, and it refuses the whole site for one of these two files. They are deleted from `site/`, and `scripts/tofu-build.mjs` deletes them after copying `build/`, so regenerating `site/` does not bring them back. Everything else in `site/` is unchanged, and no upstream source file was touched.
4. **Added this `TOFU.md`.**

The Squoosh name, logo, favicon, colours, web app manifest, screenshots, demo images and links are unchanged.

## External connections and data

- **None at runtime.** In a headless-browser check, the copy loaded, opened a demo image and encoded it with MozJPEG, AVIF, WebP and OxiPNG. It made no request outside its own origin and logged no errors.
- The Roboto Mono digits used for file sizes are embedded in the CSS as a data URL; no font CDN is contacted.
- The footer's **Privacy** link opens upstream's README. That privacy section describes squoosh.app's Google Analytics, which this copy does not load. **Source on Github** opens the upstream repository. Both are plain links.
- The page's social-preview tags (`og:image`) and `<link rel="canonical">` point to `https://squoosh.app`, fixed at build time (upstream derives them from Netlify build variables and falls back to squoosh.app). A copy's link previews therefore show the image hosted on squoosh.app, and search engines may treat squoosh.app as the main page.
- The manifest's `start_url` and share target carry upstream's `utm_` parameters; nothing in this copy reads them.

## Size

The pinned tree has about 517 files, about 67 MB unpacked and about 35 MB as a gzip archive (`git archive`). That is within the importer's limits (50 MB compressed, 20,000 files, 250 MB unpacked), so nothing was removed. `site/` itself is 87 files and 24.9 MB; the largest file is a 2.9 MB demo image.

## Upstream and licence

- Upstream: <https://github.com/GoogleChromeLabs/squoosh>, default branch `dev`.
- Base commit: `e8d35e0fb66eb16eff6fe8fc773eabcbb7128de3` (2024-08-19, "Replace deprecated terser plugin (#1423)").
- Gallery fork: <https://github.com/tofu-gallery/squoosh>. Its `dev` branch mirrors upstream untouched (this repository has no `main`); every adaptation is on `tofu`.
- Gallery pin: tag `pin/2026-10-23.1`, created only after the local build and checks below passed. The first pin, `pin/2026-10-23`, is the commit before `site/_headers` and `site/_redirects` were removed; it is otherwise identical.
- Squoosh is licensed under the Apache License 2.0, Copyright 2020 Google Inc. The root `LICENSE`, the codec licence files (`codecs/*/LICENSE.codec.md`) and every copyright header are unchanged. `site/licenses/` carries a byte-identical copy of `LICENSE`, copies of the codec licence files and a README that points to the source.
- **Before offering it:** the "Reduce palette" option uses libimagequant 2.12.1, which is licensed under the GNU GPL version 3 or later (`codecs/imagequant/LICENSE.codec.md`). The published site therefore includes GPL-licensed WebAssembly. Its corresponding source is `codecs/imagequant/` in this repository, which builds libimagequant 2.12.1 from the upstream tarball named in its `Makefile`. A copy that keeps this repository with it satisfies that; `site/licenses/README.txt` says where the source is. The other codecs are built from the projects named in each `codecs/<name>/` folder's `Makefile` or `Cargo.toml`, under those projects' own licences.

## Rebuilding and reproducing the checks

Use Node.js 20 or newer (upstream's `.nvmrc` names 20.16.0) and npm, with the unchanged upstream `package-lock.json`. From the repository root:

```sh
npm ci --no-audit --no-fund
node scripts/tofu-build.mjs
python3 -I -m http.server 8000 --bind 127.0.0.1 --directory site
```

With that server running, in a second terminal:

```sh
curl --fail --silent --show-error --output /dev/null --write-out 'HTTP %{http_code}\n' http://127.0.0.1:8000/
```

Two things to know when regenerating `site/`:

- `npm ci` runs upstream's `prepare` script, which installs husky git hooks. Their pre-commit hook runs Prettier on staged files, which would rewrite the minified files in `site/`. Commit with `git commit --no-verify`, or run `git config --local --unset core.hooksPath` after installing.
- Two builds of the same source can give a few chunks different hashed names. OxiPNG's worker helper and its module import each other, and their minified contents, and so their hashed names, vary from build to build. The features worker, the Compress chunk and the service worker, which reference them, change with them. Always replace the whole `site/` folder from one build, and never mix files from two builds.

## Verification on 2026-10-23

On macOS with Node 22.22.3 and npm 10.9.8:

- `npm ci --no-audit --no-fund` installed 824 packages from the upstream lockfile.
- `node scripts/tofu-build.mjs` ran upstream's Rollup build (`created .tmp/build in 7.7s`) and reported `site/ is ready (87 files, index.html present, no tracking endpoints found)`.
- With `python3 -I -m http.server` serving `site/`, `curl` on `/` returned `HTTP 200` (`text/html`). All 67 `/c/…` files referenced by `index.html`, the JavaScript chunks and the service worker returned 200, as did every one of the 72 files in `site/c/`; `.wasm` was served as `application/wasm`. `/manifest.json`, `/serviceworker.js` and `/licenses/README.txt` also returned 200.
- A headless Chromium (Playwright) loaded the page, clicked the "SVG icon" demo, and got a downloadable result from MozJPEG, AVIF, WebP and OxiPNG in turn. There were no console errors, page errors or failed requests, and no request left the local origin. `window.ga` was a no-op with an empty queue, and no analytics script tag existed. The page was not cross-origin isolated, so the single-threaded codecs ran.
- The same check, with the site served by upstream's `serve` and its `serve.json` (the same COOP/COEP headers as `site/_headers`), passed with `crossOriginIsolated: true`, which is the multi-threaded path.
- A second clean build reproduced `site/` except for the hash-renamed OxiPNG worker chunks described above. The committed `site/` is the build that passed the browser checks.

No app was deployed and nothing was published other than this fork.
