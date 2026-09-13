# 4K scene restoration

These images preserve the nine original 1672×941 compositions in the parent directory.

Method: local Real-ESRGAN-ncnn-vulkan (author release v0.2.5.0, 20220424 macOS), model `realesrgan-x4plus`, x4 reconstruction to 6688×3764, then Lanczos downsampling to 3840×2160, WebP quality 92 / method 6. Model processing uses overlapping internal tiles, not independently generated pictures. Tile size 256 (sunset first trial: 128).

Source and license: https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan (BSD-3-Clause). Run `scripts/upscale-scenes.sh` after downloading the official portable release to `.tools/upscale`. Original images are not replaced. AI-restored texture is inferred, not an original native-4K capture.

A preliminary built-in imagegen edit requested a 3840×2160 reconstruction preserving all mountain contours, hiker, village, lake and right-hand sunset, improving fine branches, rocks, cabin and water texture without adding objects. It returned 1672×941, so it was not used on the site. The trial is preserved at `output/imagegen/sunset-detail-trial.png`; final website assets use the original scene files as inputs to the local upscaler, with user authorization.

Rendering: Auto loads these assets when the requested long edge exceeds 1672; 4K always loads them and uses a canvas bounded to 3840px and 8.3 megapixels. HD uses original assets. Failed 4K downloads fall back to the originals. Only two decoded scenes remain in the cache. A TV may still composite web content at 1080p; the site cannot change the operating system's output mode.
