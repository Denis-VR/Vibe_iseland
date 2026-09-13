"""Prepare four CC0 nature recordings (see public/audio/SOURCES.md).
Usage: python3 scripts/prepare-night-sounds.py <directory-with-source-mp3s>
Requires ffmpeg. Keeps stereo, softens harsh high frequencies, measures loudness
before applying normalization; the player crossfades loop boundaries.
"""
import json
import pathlib
import subprocess
import sys

source = pathlib.Path(sys.argv[1])
destination = pathlib.Path('public/audio/nature')
destination.mkdir(parents=True, exist_ok=True)
for name, low, high, target in [
    ('sea', 80, 7500, -28),
    ('night', 130, 7000, -30),
    ('crickets', 180, 6500, -32),
    ('frogs', 100, 6500, -30),
]:
    filters = f'highpass=f={low},lowpass=f={high}'
    base = ['ffmpeg', '-hide_banner', '-i', str(source / f'{name}.mp3')]
    analysis = subprocess.run(base + ['-af', filters + f',loudnorm=I={target}:TP=-6:LRA=15:print_format=json', '-f', 'null', '-'], capture_output=True, text=True, check=True)
    info, _ = json.JSONDecoder().raw_decode(analysis.stderr[analysis.stderr.rindex('{'):])
    normalize = f'loudnorm=I={target}:TP=-6:LRA=15:measured_I={info["input_i"]}:measured_TP={info["input_tp"]}:measured_LRA={info["input_lra"]}:measured_thresh={info["input_thresh"]}:offset={info["target_offset"]}:linear=true'
    subprocess.run(base + ['-v', 'error', '-y', '-af', filters + ',' + normalize, '-ac', '2', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '192k', str(destination / f'{name}.mp3')], check=True)
    print(name, 'source LUFS', info['input_i'], 'target', target, flush=True)
