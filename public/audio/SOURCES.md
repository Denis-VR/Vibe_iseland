# Источники звуков «Тихой высоты»

Записи загружены в проект, воспроизведение не обращается к внешним сайтам.
Все четыре исходные полевые записи опубликованы авторами под CC0 1.0:
https://creativecommons.org/publicdomain/zero/1.0/

- `nature/campfire.mp3`: **Ambiance_Campfire_Loop_Stereo.wav**, Nox_Sound.
  https://freesound.org/people/Nox_Sound/sounds/558967/
  Публичный HQ MP3: https://cdn.freesound.org/previews/558/558967_9250976-hq.mp3
  Изменения: удалён низкочастотный гул, выровнена громкость, мягко ограничены пики.
- `nature/forest-stream.mp3`: **Water, small stream**, peridactyloptrix.
  https://freesound.org/people/peridactyloptrix/sounds/197705/
  Публичный HQ MP3: https://cdn.freesound.org/previews/197/197705_2737063-hq.mp3
  Изменения: фильтрация крайних частот и очень тихий уровень около −40 dBFS RMS.
- `nature/gentle-rain.mp3`: **soft rain drops.wav**, bruno.auzet.
  https://freesound.org/people/bruno.auzet/sounds/664162/
  Публичный HQ MP3: https://cdn.freesound.org/previews/664/664162_11519060-hq.mp3
  Изменения: цельный фрагмент 10–85 с, мягкая фильтрация и уровень около −34 dBFS RMS. Сохранены естественные хвосты капель; короткие вырезанные щелчки больше не используются.
- `nature/chickens.mp3`: **Chickens clucking and rooster with cockadoodledoo.wav**, evsecrets.
  https://freesound.org/people/evsecrets/sounds/346961/
  Публичный HQ MP3: https://cdn.freesound.org/previews/346/346961_2367065-hq.mp3
  Изменения: оставлены первые 16 секунд с курами; последующая часть с криками петуха отброшена. Мягкие края и выравнивание громкости.

Обработка: `scripts/prepare-nature.py`. При воспроизведении края записей плавно соединяются.
Исходные записи — публичные HQ MP3-превью Freesound, не оригинальные WAV.

Музыка: девять оригинальных синтезированных инструментальных композиций,
созданных для этого проекта без сторонних музыкальных сэмплов.
Первые три: `scripts/create-audio.py`. Новые шесть: `scripts/create-more-music.py`.

Нормализованные версии девяти встроенных композиций: `leveled/`. Двухпроходная нормализация воспринимаемой громкости, FFmpeg loudnorm (https://ffmpeg.org/ffmpeg-filters.html#loudnorm), целевой уровень −21 LUFS, TP −2 dBTP. Скрипт: `scripts/normalize-music.py`. Измерения до и после: `loudness.json`. Исходные музыкальные файлы сохранены.

## Море и ночные звуки — 13 сентября 2026

Все четыре записи опубликованы под **CC0 1.0**. Использованы публичные HQ MP3-превью Freesound; файлы раздаются с нашего сервера, без внешнего аудиоплеера.

| Файл | Автор и оригинал | Публичное превью |
| --- | --- | --- |
| `nature/sea.mp3` | molkko — [Sea waves](https://freesound.org/people/molkko/sounds/425632/) | https://cdn.freesound.org/previews/425/425632_3683160-hq.mp3 |
| `nature/night.mp3` | KikeVilaplana — [Night ambience with crickets](https://freesound.org/people/KikeVilaplana/sounds/436528/) | https://cdn.freesound.org/previews/436/436528_8938826-hq.mp3 |
| `nature/crickets.mp3` | FreethinkerAnon — [crickets](https://freesound.org/people/FreethinkerAnon/sounds/129678/) | https://cdn.freesound.org/previews/129/129678_2362707-hq.mp3 |
| `nature/frogs.mp3` | derjuli — [Frogs](https://freesound.org/people/derjuli/sounds/535066/) | https://cdn.freesound.org/previews/535/535066_2573247-hq.mp3 |

Обработка: `scripts/prepare-night-sounds.py` — фильтрация низкого гула и резких высоких частот, двухпроходное выравнивание до −28/−30/−32/−30 LUFS соответственно, stereo 44.1 kHz / MP3 192 kbps. Ночной пруд — запись лягушек, без добавленных эффектов. Плеер плавно соединяет края записей. Новые каналы по умолчанию выключены.
