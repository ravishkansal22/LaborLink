Drop optional 256×256 transparent WebP or PNG renders here.

Filenames (match Trade ids — already wired in workerCategories.ts):
  electrician.webp
  plumber.webp
  mason.webp
  carpenter.webp

If present, WorkerArt picks them up automatically and falls back to the inline SVG on error.
For PNG instead of WebP, change that row's imageSrc to '/worker-icons/<id>.png'.
Keep each file under ~30KB. No binaries are shipped in the repo by default.
