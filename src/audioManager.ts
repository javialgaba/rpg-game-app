import * as Phaser from 'phaser';

export interface AudioState {
  context: AudioContext | null;
  ready: boolean;
  masterGain: GainNode | null;
  sfxGain: GainNode | null;
  musicGain: GainNode | null;
  musicTimer: Phaser.Time.TimerEvent | null;
  musicStep: number;
  musicSoftened: boolean;
}

export function createAudioState(): AudioState {
  return {
    context: null,
    ready: false,
    masterGain: null,
    sfxGain: null,
    musicGain: null,
    musicTimer: null,
    musicStep: 0,
    musicSoftened: false,
  };
}

export function ensureAudio(audio: AudioState, scene: Phaser.Scene) {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) { return; }
  audio.context = audio.context || new AudioContext();
  const ctx = audio.context;
  if (!audio.masterGain) {
    audio.masterGain = ctx.createGain();
    audio.masterGain.gain.value = 0.82;
    audio.masterGain.connect(ctx.destination);

    audio.sfxGain = ctx.createGain();
    audio.sfxGain.gain.value = 0.8;
    audio.sfxGain.connect(audio.masterGain);

    audio.musicGain = ctx.createGain();
    audio.musicGain.gain.value = 0.028;
    audio.musicGain.connect(audio.masterGain);
  }
  if (audio.context.state === 'suspended') {
    audio.context.resume();
  }
  audio.ready = true;
  startVillageTheme(audio, scene);
}

interface AudioNote {
  freq: number;
  endFreq: number;
  delay: number;
  duration: number;
  wave: OscillatorType;
  gain: number;
}

const TONE_MOTIFS: Record<string, AudioNote[]> = {
  sparkle: [
    { freq: 740, endFreq: 1080, delay: 0, duration: 0.09, wave: 'triangle', gain: 0.038 },
    { freq: 980, endFreq: 1320, delay: 0.045, duration: 0.11, wave: 'sine', gain: 0.026 },
  ],
  chest: [
    { freq: 660, endFreq: 880, delay: 0, duration: 0.12, wave: 'triangle', gain: 0.045 },
    { freq: 880, endFreq: 1175, delay: 0.09, duration: 0.14, wave: 'triangle', gain: 0.052 },
    { freq: 1320, endFreq: 1760, delay: 0.2, duration: 0.18, wave: 'sine', gain: 0.035 },
  ],
  hit: [
    { freq: 330, endFreq: 220, delay: 0, duration: 0.08, wave: 'square', gain: 0.022 },
    { freq: 520, endFreq: 390, delay: 0.025, duration: 0.08, wave: 'triangle', gain: 0.018 },
  ],
  daze: [
    { freq: 520, endFreq: 610, delay: 0, duration: 0.1, wave: 'sine', gain: 0.026 },
    { freq: 430, endFreq: 510, delay: 0.1, duration: 0.12, wave: 'sine', gain: 0.023 },
  ],
  level: [
    { freq: 523, endFreq: 523, delay: 0, duration: 0.1, wave: 'triangle', gain: 0.045 },
    { freq: 659, endFreq: 659, delay: 0.1, duration: 0.12, wave: 'triangle', gain: 0.05 },
    { freq: 784, endFreq: 988, delay: 0.22, duration: 0.22, wave: 'sine', gain: 0.055 },
  ],
  bow: [
    { freq: 540, endFreq: 840, delay: 0, duration: 0.06, wave: 'triangle', gain: 0.03 },
    { freq: 260, endFreq: 180, delay: 0.015, duration: 0.1, wave: 'sine', gain: 0.017 },
  ],
  repair: [
    { freq: 440, endFreq: 587, delay: 0, duration: 0.1, wave: 'triangle', gain: 0.04 },
    { freq: 587, endFreq: 740, delay: 0.1, duration: 0.12, wave: 'triangle', gain: 0.038 },
    { freq: 880, endFreq: 1175, delay: 0.21, duration: 0.16, wave: 'sine', gain: 0.028 },
  ],
  gameOver: [
    { freq: 392, endFreq: 330, delay: 0, duration: 0.2, wave: 'triangle', gain: 0.038 },
    { freq: 330, endFreq: 262, delay: 0.18, duration: 0.28, wave: 'sine', gain: 0.034 },
    { freq: 262, endFreq: 220, delay: 0.43, duration: 0.36, wave: 'sine', gain: 0.026 },
  ],
};

export function playTone(audio: AudioState, type: string = 'sparkle') {
  if (!audio.ready || !audio.context) { return; }
  const ctx = audio.context;
  const now = ctx.currentTime;
  const motifs = TONE_MOTIFS[type] || TONE_MOTIFS.sparkle;
  motifs.forEach((note) => playAudioNote(audio, note, now, audio.sfxGain));
}

export function playAudioNote(audio: AudioState, note: AudioNote, baseTime: number, destination: GainNode | null) {
  const ctx = audio.context;
  if (!ctx) { return; }
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = baseTime + (note.delay || 0);
  const duration = note.duration || 0.12;
  osc.type = note.wave || 'sine';
  osc.frequency.setValueAtTime(note.freq, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, note.endFreq || note.freq), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(note.gain || 0.03, start + 0.014);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration + 0.045);
  osc.connect(gain);
  gain.connect(destination || audio.sfxGain || ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.07);
}

export function startVillageTheme(audio: AudioState, scene: Phaser.Scene) {
  if (!audio.ready || audio.musicTimer) { return; }
  scheduleVillageTheme(audio);
  audio.musicTimer = scene.time.addEvent({
    delay: 3200,
    loop: true,
    callback: () => scheduleVillageTheme(audio),
  });
}

function scheduleVillageTheme(audio: AudioState) {
  if (!audio.ready || !audio.context || !audio.musicGain) { return; }
  const ctx = audio.context;
  const now = ctx.currentTime;
  const chords = [
    [392, 523, 659],
    [440, 554, 659],
    [349, 523, 698],
    [392, 494, 659],
  ];
  const chord = chords[audio.musicStep % chords.length];
  const baseGain = audio.musicSoftened ? 0.008 : 0.018;
  chord.forEach((freq, index) => {
    playAudioNote(audio, {
      freq,
      endFreq: freq * 1.005,
      delay: index * 0.42,
      duration: 1.05,
      wave: index === 0 ? 'sine' : 'triangle',
      gain: baseGain * (index === 0 ? 0.78 : 1),
    }, now, audio.musicGain);
  });
  audio.musicStep += 1;
}

export function setMusicSoftened(audio: AudioState, softened: boolean) {
  audio.musicSoftened = softened;
  if (!audio.musicGain || !audio.context) { return; }
  const target = softened ? 0.012 : 0.028;
  audio.musicGain.gain.setTargetAtTime(target, audio.context.currentTime, 0.18);
}
