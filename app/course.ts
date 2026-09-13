export type Playlist = { id: string; name: string; tracks: string[] };
export type StudyState = { playlists: Playlist[] };
export const initialState: StudyState = {
  playlists: [{ id: "personal", name: "Мой горный плейлист", tracks: [] }],
};
export const builtins = [
  {
    id: "ambient-dawn",
    name: "Рассвет над долиной",
    subtitle: "Мягкий эмбиент · 4:00",
    url: "/audio/dawn.mp3",
  },
  {
    id: "ambient-clouds",
    name: "Между облаками",
    subtitle: "Спокойные клавиши · 4:00",
    url: "/audio/clouds.mp3",
  },
  {
    id: "ambient-night",
    name: "Огни горного приюта",
    subtitle: "Тёплый дрон · 4:00",
    url: "/audio/night.mp3",
  },
];
