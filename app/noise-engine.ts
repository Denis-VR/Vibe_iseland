export type NoiseKind =
  | "white"
  | "pink"
  | "brown"
  | "rain"
  | "downpour"
  | "roof"
  | "birds"
  | "wind"
  | "water"
  | "fire"
  | "stream"
  | "village"
  | "sea"
  | "night"
  | "crickets"
  | "frogs";
export const noiseChannels: { id: NoiseKind; name: string; hint: string }[] = [
  { id: "white", name: "Белый шум", hint: "Ровный, воздушный" },
  { id: "pink", name: "Розовый шум", hint: "Мягкий и сбалансированный" },
  { id: "brown", name: "Коричневый шум", hint: "Глубокий низкий гул" },
  {
    id: "rain",
    name: "Мелкий дождь",
    hint: "Мягкий дождь и негромкие капли",
  },
  { id: "downpour", name: "Ливень", hint: "Плотная стена воды, без грома" },
  {
    id: "roof",
    name: "Дождь по крыше",
    hint: "Приглушённые капли под навесом",
  },
  { id: "birds", name: "Птицы", hint: "Редкие далёкие трели" },
  { id: "wind", name: "Ветер", hint: "Медленные порывы в кронах" },
  { id: "water", name: "Водопад", hint: "Ровный плотный поток воды" },
  {
    id: "stream",
    name: "Лесной ручеёк",
    hint: "Едва слышное журчание маленького ручья",
  },
  { id: "village", name: "Деревенский двор", hint: "Тихое кудахтанье кур" },
  { id: "fire", name: "Костёр", hint: "Настоящий костёр: пламя и сухие дрова" },
  { id: "sea", name: "Море", hint: "Волны мягко накатывают на берег" },
  { id: "night", name: "Летняя ночь", hint: "Ночной воздух и хор насекомых" },
  { id: "crickets", name: "Сверчки", hint: "Тихое стрекотание в траве" },
  { id: "frogs", name: "Ночной пруд", hint: "Лягушки у воды" },
];
export const fieldRecordings: Partial<Record<NoiseKind, string>> = {
  fire: publicPath("audio/nature/campfire.mp3"),
  stream: publicPath("audio/nature/forest-stream.mp3"),
  rain: publicPath("audio/nature/gentle-rain.mp3"),
  village: publicPath("audio/nature/chickens.mp3"),
  sea: publicPath("audio/nature/sea.mp3"),
  night: publicPath("audio/nature/night.mp3"),
  crickets: publicPath("audio/nature/crickets.mp3"),
  frogs: publicPath("audio/nature/frogs.mp3"),
};
export class NoiseEngine {
  context: AudioContext;
  master: GainNode;
  filter: BiquadFilterNode;
  nodes = new Map<
    NoiseKind,
    { source: AudioBufferSourceNode; gain: GainNode }
  >();
  private levels = new Map<NoiseKind, number>();
  private loading = new Map<NoiseKind, Promise<void>>();
  private abort = new AbortController();
  private closed = false;
  private reportError: (message: string) => void;
  constructor(reportError: (message: string) => void = () => {}) {
    this.reportError = reportError;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0;
    this.filter = this.context.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 6500;
    this.filter.connect(this.master);
    this.master.connect(this.context.destination);
  }
  async start() {
    await this.context.resume();
  }
  setMaster(volume: number) {
    this.master.gain.setTargetAtTime(
      (volume / 100) * 0.65,
      this.context.currentTime,
      0.25,
    );
  }
  setTone(softness: number) {
    this.filter.frequency.setTargetAtTime(
      12000 * Math.pow(900 / 12000, softness / 100),
      this.context.currentTime,
      0.3,
    );
  }
  set(kind: NoiseKind, volume: number) {
    if (this.closed) return;
    this.levels.set(kind, volume);
    const node = this.nodes.get(kind);
    if (node) {
      node.gain.gain.setTargetAtTime(
        volume / 100,
        this.context.currentTime,
        0.25,
      );
      return;
    }
    if (volume <= 0 || this.loading.has(kind)) return;
    const work = this.load(kind)
      .catch(() => {
        if (!this.closed)
          this.reportError(
            `Не удалось загрузить звук «${noiseChannels.find((c) => c.id === kind)?.name}». Попробуй включить его ещё раз.`,
          );
      })
      .finally(() => this.loading.delete(kind));
    this.loading.set(kind, work);
  }
  private async load(kind: NoiseKind) {
    const file = fieldRecordings[kind];
    let buffer: AudioBuffer;
    if (file) {
      const response = await fetch(file, { signal: this.abort.signal });
      if (!response.ok) throw Error("sound missing");
      const decoded = await this.context.decodeAudioData(
        await response.arrayBuffer(),
      );
      if (this.closed) return;
      // Crossfade the ends of field recordings, then remove the duplicated head.
      const fade = Math.min(
        Math.floor(decoded.sampleRate * 0.3),
        Math.floor(decoded.length / 4),
      );
      buffer = this.context.createBuffer(
        decoded.numberOfChannels,
        decoded.length - fade,
        decoded.sampleRate,
      );
      for (let c = 0; c < decoded.numberOfChannels; c++) {
        const input = decoded.getChannelData(c),
          out = buffer.getChannelData(c);
        out.set(input.subarray(fade));
        for (let i = 0; i < fade; i++) {
          const p = i / fade;
          out[out.length - fade + i] =
            input[input.length - fade + i] * Math.cos((p * Math.PI) / 2) +
            input[i] * Math.sin((p * Math.PI) / 2);
        }
      }
    } else {
      const sr = 22050;
      buffer = this.context.createBuffer(2, sr * 47.5, sr);
      for (let c = 0; c < 2; c++)
        buffer.copyToChannel(createNoiseSamples(kind, sr, 48), c);
    }
    if (this.closed) return;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = this.context.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(file ? this.master : this.filter);
    source.start();
    this.nodes.set(kind, { source, gain });
    gain.gain.setTargetAtTime(
      (this.levels.get(kind) || 0) / 100,
      this.context.currentTime,
      0.25,
    );
  }
  async close() {
    this.closed = true;
    this.abort.abort();
    for (const { source } of this.nodes.values()) source.stop();
    await this.context.close();
  }
}

/** Smooth stochastic beds; tonal bird synthesis is isolated to the birds channel. */
export function createNoiseSamples(
  kind: NoiseKind,
  sr = 22050,
  seconds = 48,
  random = Math.random,
) {
  if (fieldRecordings[kind]) throw Error("This channel uses a field recording");
  const length = Math.round(sr * seconds),
    samples = new Float32Array(length);
  let low = 0,
    mid = 0,
    brown = 0,
    drop = 0,
    nextBird = 2 + random() * 4;
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0;
  const birds: {
    start: number;
    duration: number;
    frequency: number;
    sweep: number;
  }[] = [];
  if (kind === "birds")
    while (nextBird < seconds - 1) {
      const base = 1900 + random() * 1200;
      for (let j = 0; j < 2 + Math.floor(random() * 3); j++)
        birds.push({
          start: nextBird + j * 0.32,
          duration: 0.12 + random() * 0.14,
          frequency: base,
          sweep: 300 + random() * 600,
        });
      nextBird += 5 + random() * 7;
    }
  for (let i = 0; i < length; i++) {
    const t = i / sr,
      white = random() * 2 - 1;
    low += 0.012 * (white - low);
    mid += 0.18 * (white - mid);
    brown = (brown + 0.025 * white) / 1.025;
    const swell =
      0.78 +
      0.12 * Math.sin((2 * Math.PI * t) / seconds) +
      0.1 * Math.sin((6 * Math.PI * t) / seconds);
    let v = 0;
    if (kind === "white") v = white * 0.15;
    if (kind === "pink") {
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      v = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.025;
      b6 = white * 0.115926;
    }
    if (kind === "brown") v = brown * 0.9;
    if (kind === "wind") v = low * 1.05 * swell;
    if (kind === "downpour") v = (mid * 0.48 + white * 0.1 + low * 0.3) * swell;
    if (kind === "roof") {
      if (random() < 12 / sr) drop = 0.035 + random() * 0.065;
      drop *= Math.exp(-1 / (sr * 0.045));
      v = mid * 0.24 + low * 0.25 + drop * mid * 2;
    }
    // Broadband water only: no periodic oscillator, whistles or birds.
    if (kind === "water")
      v =
        (mid * 0.55 + low * 0.45) *
        (swell + 0.08 * Math.sin((10 * Math.PI * t) / seconds));
    if (kind === "birds")
      for (const bird of birds) {
        const age = t - bird.start;
        if (age >= 0 && age < bird.duration) {
          const p = age / bird.duration;
          v +=
            0.045 *
            Math.sin(Math.PI * p) ** 2 *
            Math.sin(
              2 *
                Math.PI *
                (bird.frequency * age +
                  (bird.sweep * age * age) / (2 * bird.duration)),
            );
        }
      }
    samples[i] = v;
  }
  // Long equal-power loop seam; no abrupt amplitude impulses at the boundary.
  const fade = Math.min(Math.round(sr * 0.5), Math.floor(length / 4));
  for (let i = 0; i < fade; i++) {
    const p = i / fade;
    samples[length - fade + i] =
      samples[length - fade + i] * Math.cos((p * Math.PI) / 2) +
      samples[i] * Math.sin((p * Math.PI) / 2);
  }
  return samples.slice(fade);
}
import { publicPath } from "./public-path.ts";
