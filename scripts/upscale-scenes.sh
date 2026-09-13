#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Portable Real-ESRGAN v0.2.5.0, downloaded from the author's GitHub release.
# Keep originals intact; x4 reconstruction is reduced to 3840x2160 for delivery.
mkdir -p output/upscale public/scenes/uhd
for scene in sunset day dawn night rain fog winter spring autumn; do
  if [ -s "public/scenes/uhd/$scene.webp" ]; then continue; fi
  echo "Upscaling $scene"
  sips -s format png "public/scenes/$scene.webp" --out "output/upscale/$scene-input.png" >/dev/null
  .tools/upscale/realesrgan-ncnn-vulkan -i "output/upscale/$scene-input.png" -o "output/upscale/$scene-x4.png" -n realesrgan-x4plus -m .tools/upscale/models -s 4 -t 256 -j 1:1:1 > "output/upscale/$scene.log" 2>&1
  ffmpeg -v error -y -i "output/upscale/$scene-x4.png" -vf scale=3840:2160:flags=lanczos "output/upscale/$scene-4k.png"
  cwebp -quiet -q 92 -m 6 "output/upscale/$scene-4k.png" -o "public/scenes/uhd/$scene.webp"
  echo "Ready $scene"
done
