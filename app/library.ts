export type Playlist = { id: string; name: string; tracks: string[] };
export type LibraryState = { playlists: Playlist[] };
export const initialState: LibraryState = {
  playlists: [{ id: "personal", name: "Мой горный плейлист", tracks: [] }],
};
export const builtins = [
  {
    id: "ambient-dawn",
    name: "Рассвет над долиной",
    subtitle: "Мягкий эмбиент · 4:00",
    url: "/audio/leveled/dawn.mp3",
  },
  {
    id: "ambient-clouds",
    name: "Между облаками",
    subtitle: "Спокойные клавиши · 4:00",
    url: "/audio/leveled/clouds.mp3",
  },
  {
    id: "ambient-night",
    name: "Огни горного приюта",
    subtitle: "Тёплый дрон · 4:00",
    url: "/audio/leveled/night.mp3",
  },
  {
    id: "ambient-quiet-piano",
    name: "Тихие клавиши",
    subtitle: "Медленное пиано · 4:00",
    url: "/audio/leveled/quiet-piano.mp3",
  },
  {
    id: "ambient-amber-room",
    name: "Янтарная комната",
    subtitle: "Мягкий lo-fi · 4:00",
    url: "/audio/leveled/amber-room.mp3",
  },
  {
    id: "ambient-silent-orbit",
    name: "Тихая орбита",
    subtitle: "Просторный эмбиент · 4:00",
    url: "/audio/leveled/silent-orbit.mp3",
  },
  {
    id: "ambient-cedar-strings",
    name: "Кедровые струны",
    subtitle: "Тёплые переборы · 4:00",
    url: "/audio/leveled/cedar-strings.mp3",
  },
  {
    id: "ambient-first-snow",
    name: "Первый снег",
    subtitle: "Редкие стеклянные ноты · 4:00",
    url: "/audio/leveled/first-snow.mp3",
  },
  {
    id: "ambient-warm-keys",
    name: "Свет в окне",
    subtitle: "Бархатные клавиши · 4:00",
    url: "/audio/leveled/warm-keys.mp3",
  },
];
