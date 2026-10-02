export type ClickSound =
  | "start"
  | "key"
  | "clicker"
  | "toggle"
  | "dial"
  | "roller"
  | "reset";
export type ClickPhase = "press" | "release";

type Voice = {
  pack: string;
  gain: number;
  rate: number;
  pan: number;
  cutoff: number;
  length?: number;
};
const voices: Record<ClickSound, Voice> = {
  start: {
    pack: "cream-wide",
    gain: 0.48,
    rate: 0.95,
    pan: -0.27,
    cutoff: 7600,
  },
  key: { pack: "cream", gain: 0.34, rate: 1, pan: -0.22, cutoff: 7200 },
  reset: { pack: "cream", gain: 0.29, rate: 0.95, pan: -0.04, cutoff: 6500 },
  clicker: {
    pack: "holypanda",
    gain: 0.37,
    rate: 1.04,
    pan: 0.38,
    cutoff: 8500,
  },
  toggle: { pack: "boxnavy", gain: 0.29, rate: 1.05, pan: -0.19, cutoff: 7200 },
  dial: {
    pack: "boxnavy",
    gain: 0.16,
    rate: 1.65,
    pan: 0.21,
    cutoff: 6300,
    length: 0.034,
  },
  roller: {
    pack: "holypanda",
    gain: 0.115,
    rate: 1.8,
    pan: 0.28,
    cutoff: 5000,
    length: 0.028,
  },
};
const filenames = [
  ...["cream", "holypanda", "boxnavy"].flatMap((pack) =>
    [1, 2, 3]
      .map((index) => `${pack}-down-${index}.mp3`)
      .concat(`${pack}-up.mp3`),
  ),
  "cream-wide-down.mp3",
  "cream-wide-up.mp3",
];

/** Recorded switches, separately played on downstroke and return. Assets are local. */
export class MechanicalAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private files = new Map<string, ArrayBuffer>();
  private samples = new Map<string, AudioBuffer>();
  private fetching: Promise<void> | null = null;
  private decoding: Promise<void> | null = null;
  private decodedReady = false;
  private abort = new AbortController();
  private disposed = false;
  private enabled = true;
  private volume = 0.35;
  private lastTick: Partial<Record<ClickSound, number>> = {};
  private variation: Partial<Record<ClickSound, number>> = {};

  preload() {
    if (this.fetching) return this.fetching;
    this.fetching = Promise.allSettled(
      filenames.map(async (name) => {
        const response = await fetch(`/instrument/${name}`, {
          signal: this.abort.signal,
          cache: "force-cache",
        });
        if (!response.ok) throw new Error(`Sound unavailable: ${name}`);
        const bytes = await response.arrayBuffer();
        if (!this.disposed) this.files.set(name, bytes);
      }),
    ).then(() => {});
    return this.fetching;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (this.context && this.master)
      this.master.gain.setTargetAtTime(
        enabled ? this.volume : 0,
        this.context.currentTime,
        0.008,
      );
  }
  setVolume(volume: number) {
    this.volume = Math.min(1, Math.max(0, volume));
    if (this.context && this.master)
      this.master.gain.setTargetAtTime(
        this.enabled ? this.volume : 0,
        this.context.currentTime,
        0.015,
      );
  }

  private ready() {
    if (!this.enabled || this.disposed) return false;
    if (!this.context) {
      try {
        const context = new AudioContext({ latencyHint: "interactive" });
        this.context = context;
        this.master = context.createGain();
        this.master.gain.value = this.volume;
        const highpass = context.createBiquadFilter();
        highpass.type = "highpass";
        highpass.frequency.value = 55;
        highpass.Q.value = 0.5;
        const limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -8;
        limiter.knee.value = 6;
        limiter.ratio.value = 5;
        limiter.attack.value = 0.002;
        limiter.release.value = 0.07;
        this.master
          .connect(highpass)
          .connect(limiter)
          .connect(context.destination);
      } catch {
        return false;
      }
    }
    if (this.context.state === "suspended")
      void this.context.resume().catch(() => {});
    return this.context.state !== "closed";
  }

  private decode() {
    if (this.decoding) return this.decoding;
    const context = this.context!;
    this.decoding = this.preload().then(async () => {
      await Promise.allSettled(
        Array.from(this.files, async ([name, bytes]) => {
          const decoded = await context.decodeAudioData(bytes.slice(0));
          if (this.disposed) return;
          const data = decoded.getChannelData(0);
          let peak = 0;
          for (const sample of data) peak = Math.max(peak, Math.abs(sample));
          let first = 0;
          while (first < data.length && Math.abs(data[first]) < peak * 0.025)
            first++;
          first = Math.max(0, first - Math.floor(decoded.sampleRate * 0.0015));
          const count = Math.min(
            data.length - first,
            Math.floor(decoded.sampleRate * 0.19),
          );
          if (count < 1 || peak < 0.0001) return;
          const buffer = context.createBuffer(1, count, decoded.sampleRate);
          const samples = buffer.getChannelData(0);
          for (let i = 0; i < count; i++) {
            const fade = Math.min(
              1,
              i / (decoded.sampleRate * 0.0004),
              (count - i) / (decoded.sampleRate * 0.004),
            );
            samples[i] = data[first + i] * (0.68 / peak) * fade;
          }
          this.samples.set(name, buffer);
        }),
      );
      this.decodedReady = true;
    });
    return this.decoding;
  }

  private play(kind: ClickSound, phase: ClickPhase) {
    if (!this.context || !this.master || !this.enabled || this.disposed) return;
    const voice = voices[kind];
    const next = ((this.variation[kind] ?? 0) + 1) % 3;
    this.variation[kind] = next;
    const name =
      voice.pack === "cream-wide"
        ? `cream-wide-${phase === "press" ? "down" : "up"}.mp3`
        : phase === "press"
          ? `${voice.pack}-down-${next + 1}.mp3`
          : `${voice.pack}-up.mp3`;
    const buffer = this.samples.get(name);
    if (!buffer) return;
    const context = this.context,
      now = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = voice.rate * (1 + (next - 1) * 0.008);
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = voice.cutoff;
    filter.Q.value = 0.55;
    const envelope = context.createGain();
    const gain = voice.gain * (phase === "release" ? 0.74 : 1);
    envelope.gain.value = gain;
    const panner = context.createStereoPanner();
    panner.pan.value = voice.pan;
    source
      .connect(filter)
      .connect(envelope)
      .connect(panner)
      .connect(this.master);
    const start = now + (phase === "press" ? 0.012 : 0.008);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
      panner.disconnect();
    };
    source.start(start);
    if (voice.length) {
      envelope.gain.setValueAtTime(gain, start);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + voice.length);
      source.stop(start + voice.length + 0.003);
    }
  }

  click(kind: ClickSound, phase: ClickPhase = "press") {
    if (document.hidden || !this.ready() || !this.context) return;
    const now = performance.now();
    if (
      (kind === "dial" || kind === "roller") &&
      now - (this.lastTick[kind] ?? -Infinity) < (kind === "roller" ? 36 : 28)
    )
      return;
    this.lastTick[kind] = now;
    if (this.decodedReady) this.play(kind, phase);
    else
      void this.decode().then(() => {
        // A late asset must never play after the interaction has already passed.
        if (performance.now() - now < 100) this.play(kind, phase);
      });
  }

  bell() {
    if (
      !this.enabled ||
      !this.context ||
      this.context.state !== "running" ||
      !this.master
    )
      return;
    const context = this.context,
      now = context.currentTime;
    for (const [frequency, amplitude, decay] of [
      [660, 0.075, 1.1],
      [991, 0.03, 0.7],
      [1327, 0.012, 0.4],
    ]) {
      const oscillator = context.createOscillator(),
        envelope = context.createGain();
      oscillator.frequency.value = frequency;
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime(amplitude, now + 0.006);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + decay);
      oscillator.connect(envelope).connect(this.master);
      oscillator.onended = () => {
        oscillator.disconnect();
        envelope.disconnect();
      };
      oscillator.start(now);
      oscillator.stop(now + decay + 0.02);
    }
  }
  dispose() {
    this.disposed = true;
    this.abort.abort();
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
    this.master = null;
    this.files.clear();
    this.samples.clear();
  }
}
