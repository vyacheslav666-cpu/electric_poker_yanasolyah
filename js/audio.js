import { MUSIC_TRACKS } from './config.js';

/** Original procedural music and short interface sound effects. */
let audioContext;
let musicTimer;
let musicStep = 0;
let activeTrackId = MUSIC_TRACKS[0].id;
let settingsProvider = () => ({ music: false, sound: true, musicTrack: activeTrackId });

const TRACK_PRESETS = {
  'velvet-shuffle': {
    bpm: 104,
    swing: .2,
    chordEvery: 4,
    chords: [
      [261.63, 329.63, 392, 440], [220, 277.18, 329.63, 392],
      [293.66, 349.23, 440, 523.25], [196, 246.94, 293.66, 349.23]
    ],
    bass: [65.41, 82.41, 98, 110, 55, 69.3, 82.41, 98, 73.42, 87.31, 110, 123.47, 49, 61.74, 73.42, 87.31],
    melody: [null, null, 659.25, null, 587.33, null, 523.25, null, null, 493.88, null, null, 440, null, 493.88, null, null, null, 523.25, null, 587.33, 523.25, null, null, 493.88, null, 440, null, null, 392, null, null],
    chordType: 'triangle', melodyType: 'triangle', chordFilter: 1250, melodyFilter: 1550
  },
  'neon-bossa': {
    bpm: 116,
    swing: .04,
    chordEvery: 4,
    chords: [
      [220, 261.63, 329.63, 392], [246.94, 293.66, 369.99, 440],
      [196, 246.94, 293.66, 369.99], [220, 277.18, 329.63, 415.3]
    ],
    bass: [55, 82.41, 110, 82.41, 61.74, 92.5, 123.47, 92.5, 49, 73.42, 98, 73.42, 55, 82.41, 110, 103.83],
    melody: [659.25, null, 587.33, null, null, 523.25, null, 493.88, 440, null, 493.88, null, 554.37, null, 493.88, null, 440, null, 392, 440, null, 493.88, null, null, 523.25, null, 493.88, null, 440, 392, null, null],
    chordType: 'sine', melodyType: 'sine', chordFilter: 1750, melodyFilter: 2100
  },
  'midnight-drive': {
    bpm: 92,
    swing: 0,
    chordEvery: 8,
    chords: [
      [130.81, 196, 261.63, 311.13], [146.83, 220, 293.66, 349.23],
      [110, 164.81, 220, 261.63], [123.47, 185, 246.94, 293.66]
    ],
    bass: [65.41, 65.41, 98, 65.41, 73.42, 73.42, 110, 73.42, 55, 55, 82.41, 55, 61.74, 61.74, 92.5, 61.74],
    melody: [523.25, null, null, 622.25, null, null, 587.33, null, 493.88, null, null, 440, null, null, 392, null, 440, null, null, 523.25, null, 587.33, null, null, 622.25, null, 587.33, null, 523.25, null, null, null],
    chordType: 'sawtooth', melodyType: 'square', chordFilter: 720, melodyFilter: 1250
  },
  'high-roller': {
    bpm: 132,
    swing: .26,
    chordEvery: 4,
    chords: [
      [293.66, 369.99, 440, 523.25], [329.63, 415.3, 493.88, 587.33],
      [261.63, 329.63, 392, 466.16], [293.66, 369.99, 440, 523.25]
    ],
    bass: [73.42, 110, 123.47, 138.59, 82.41, 123.47, 138.59, 155.56, 65.41, 98, 110, 123.47, 73.42, 110, 138.59, 146.83],
    melody: [880, null, 739.99, null, 659.25, null, 587.33, 659.25, null, 739.99, null, 880, null, 987.77, 880, null, 783.99, null, 659.25, null, 587.33, 659.25, null, 739.99, 880, null, 987.77, null, 1046.5, 987.77, 880, null],
    chordType: 'triangle', melodyType: 'square', chordFilter: 1550, melodyFilter: 2400
  }
};

/** Give audio functions live access to the application sound settings. */
export function configureAudio(provider) {
  settingsProvider = provider;
  activeTrackId = resolveTrackId(settingsProvider().musicTrack);
}

function resolveTrackId(trackId) {
  return TRACK_PRESETS[trackId] ? trackId : MUSIC_TRACKS[0].id;
}

function getAudioContext() {
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === 'suspended') audioContext.resume();
  return audioContext;
}

function synthVoice(context, frequency, options = {}) {
  const now = context.currentTime;
  const osc = context.createOscillator();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  const attack = options.attack ?? .025;
  const duration = options.duration ?? .42;
  osc.type = options.type || 'triangle';
  osc.frequency.value = frequency;
  filter.type = 'lowpass';
  filter.frequency.value = options.filter ?? 1100;
  gain.gain.setValueAtTime(.0001, now);
  gain.gain.exponentialRampToValueAtTime(options.volume ?? .006, now + attack);
  gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
  osc.connect(filter).connect(gain).connect(context.destination);
  osc.start(now);
  osc.stop(now + duration + .03);
}

function playRhythm(context, preset, step) {
  if (step % 4 === 0) {
    synthVoice(context, activeTrackId === 'midnight-drive' ? 74 : 92, {
      type: 'sine', volume: .012, attack: .006, duration: .13, filter: 210
    });
  }
  if (step % 2 === 1) {
    synthVoice(context, activeTrackId === 'neon-bossa' ? 2200 : 3300, {
      type: 'square', volume: .0008, attack: .003, duration: .045, filter: 5600
    });
  }
  if (activeTrackId === 'high-roller' && step % 8 === 6) {
    synthVoice(context, 1800, { type: 'square', volume: .0012, attack: .002, duration: .07, filter: 4200 });
  }
}

/** Schedule one track step and queue the next swung eighth-note interval. */
function playMusicStep() {
  if (!settingsProvider().music) {
    musicTimer = null;
    return;
  }

  const requestedTrackId = resolveTrackId(settingsProvider().musicTrack);
  if (requestedTrackId !== activeTrackId) {
    activeTrackId = requestedTrackId;
    musicStep = 0;
  }

  try {
    const context = getAudioContext();
    const preset = TRACK_PRESETS[activeTrackId];
    const step = musicStep % 32;

    if (step % preset.chordEvery === 0) {
      const chord = preset.chords[Math.floor(step / preset.chordEvery) % preset.chords.length];
      chord.forEach((frequency, index) => {
        synthVoice(context, frequency, {
          type: index % 2 ? 'sine' : preset.chordType,
          volume: activeTrackId === 'midnight-drive' ? .0022 : .0028,
          attack: .018 + index * .008,
          duration: activeTrackId === 'midnight-drive' ? 1.05 : .62,
          filter: preset.chordFilter
        });
      });
    }

    if (step % 2 === 0) {
      synthVoice(context, preset.bass[Math.floor(step / 2) % preset.bass.length], {
        type: activeTrackId === 'midnight-drive' ? 'sawtooth' : 'triangle',
        volume: activeTrackId === 'high-roller' ? .012 : .009,
        attack: .014,
        duration: .38,
        filter: activeTrackId === 'midnight-drive' ? 330 : 460
      });
    }

    if (preset.melody[step]) {
      synthVoice(context, preset.melody[step], {
        type: preset.melodyType,
        volume: activeTrackId === 'high-roller' ? .0032 : .0028,
        attack: .035,
        duration: .3,
        filter: preset.melodyFilter
      });
    }

    playRhythm(context, preset, step);
  } catch { /* Audio is optional and must never block the game. */ }

  const preset = TRACK_PRESETS[activeTrackId];
  const baseDelay = 30000 / preset.bpm;
  const swingFactor = musicStep % 2 ? 1 + preset.swing : 1 - preset.swing;
  musicStep++;
  musicTimer = setTimeout(playMusicStep, Math.round(baseDelay * swingFactor));
}

export function setMusicTrack(trackId) {
  const nextTrackId = resolveTrackId(trackId);
  clearTimeout(musicTimer);
  musicTimer = null;
  musicStep = 0;
  activeTrackId = nextTrackId;
  if (settingsProvider().music) playMusicStep();
  return nextTrackId;
}

export function startMusic() {
  if (!settingsProvider().music || musicTimer) return;
  activeTrackId = resolveTrackId(settingsProvider().musicTrack);
  playMusicStep();
}

export function stopMusic() {
  clearTimeout(musicTimer);
  musicTimer = null;
}

export function playTone(type) {
  if (settingsProvider().music) startMusic();
  if (!settingsProvider().sound) return;
  try {
    const context = getAudioContext();
    const now = context.currentTime;
    const notes = {
      click: [420], deal: [240, 330], draw: [300, 390],
      lose: [230, 170], error: [130], win: [440, 554, 659, 880],
      bigWin: [392, 523.25, 659.25, 783.99, 1046.5],
      jackpot: [261.63, 392, 523.25, 659.25, 783.99, 1046.5, 1318.51]
    }[type] || [300];
    notes.forEach((frequency, index) => {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = ['win', 'bigWin', 'jackpot'].includes(type) ? 'triangle' : 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001, now + index * .09);
      gain.gain.exponentialRampToValueAtTime(.065, now + index * .09 + .01);
      gain.gain.exponentialRampToValueAtTime(.0001, now + index * .09 + .13);
      osc.connect(gain).connect(context.destination);
      osc.start(now + index * .09);
      osc.stop(now + index * .09 + .15);
    });
  } catch { /* Audio is optional. */ }
}
