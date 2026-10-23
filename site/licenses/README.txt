Squoosh - licences and source

This site is a build of Squoosh, https://github.com/GoogleChromeLabs/squoosh
Copyright 2020 Google Inc., licensed under the Apache License, Version 2.0
(squoosh-LICENSE.txt). It was built from the tofu-gallery copy,
https://github.com/tofu-gallery/squoosh (branch "tofu"; each gallery pin is a
"pin/<date>" tag), which removes Google Analytics; see TOFU.md there.

The image codecs are third-party projects compiled to WebAssembly. Upstream
ships licence files for hqx, imagequant, mozjpeg, oxipng, resize, webp; they are copied here as
codec-<name>-LICENSE.txt. The other codecs are built from the projects named in
codecs/<name>/ of the source repository, under those projects' own licences.

The "Reduce palette" option uses libimagequant 2.12.1, licensed under the GNU
GPL version 3 or later (codec-imagequant-LICENSE.txt). Its corresponding source
is codecs/imagequant/ in the source repository above, which builds
libimagequant 2.12.1 from
https://github.com/ImageOptim/libimagequant/archive/2.12.1.tar.gz
