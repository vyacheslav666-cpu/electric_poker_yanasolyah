/** Web Audio casino-jazz and short interface sound effects. */
let audioContext;
let musicTimer;
let musicStep = 0;
let settingsProvider = () => ({ music: false, sound: true });

/** Give audio functions live access to the application sound settings. */
export function configureAudio(provider) {
  settingsProvider = provider;
}

function getAudioContext() {
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === 'suspended') audioContext.resume();
  return audioContext;
}

function jazzVoice(context, frequency, options = {}) {
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
  // A short envelope removes clicks and keeps layered voices soft enough for UI.
  gain.gain.setValueAtTime(.0001, now);
  gain.gain.exponentialRampToValueAtTime(options.volume ?? .006, now + attack);
  gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
  osc.connect(filter).connect(gain).connect(context.destination);
  osc.start(now);
  osc.stop(now + duration + .03);
}

/** Schedule one swung casino-jazz step, then queue the next long/short interval. */
function playMusicNote() {
  if (!settingsProvider().music) {
    musicTimer = null;
    return;
  }
  try {
    const context = getAudioContext();
    // Harmony, walking bass and sparse melody share a 32-step loop.
    const chords = [
      [261.63, 329.63, 392, 440],
      [220, 277.18, 329.63, 392],
      [293.66, 349.23, 440, 523.25],
      [196, 246.94, 293.66, 349.23],
      [329.63, 392, 493.88, 587.33],
      [220, 277.18, 329.63, 392],
      [293.66, 349.23, 440, 523.25],
      [196, 246.94, 293.66, 349.23]
    ];
    const bassLine = [
      65.41, 82.41, 98, 110,
      55, 69.3, 82.41, 98,
      73.42, 87.31, 110, 123.47,
      49, 61.74, 73.42, 87.31
    ];
    const melody = [
      null, null, 659.25, null, 587.33, null, 523.25, null,
      null, 493.88, null, null, 440, null, 493.88, null,
      null, null, 523.25, null, 587.33, 523.25, null, null,
      493.88, null, 440, null, null, 392, null, null
    ];
    const step = musicStep % 32;

    if (step % 4 === 0) {
      const chord = chords[Math.floor(step / 4)];
      chord.forEach((frequency, index) => {
        jazzVoice(context, frequency, {
          type: index % 2 ? 'sine' : 'triangle',
          volume: .0028,
          attack: .018 + index * .008,
          duration: .62,
          filter: 1250
        });
      });
    }

    if (step % 2 === 0) {
      jazzVoice(context, bassLine[Math.floor(step / 2)], {
        type: 'triangle',
        volume: .011,
        attack: .018,
        duration: .5,
        filter: 420
      });
    }

    if (melody[step]) {
      jazzVoice(context, melody[step], {
        type: 'triangle',
        volume: .0042,
        attack: .045,
        duration: .38,
        filter: 1550
      });
    }
    musicStep++;
  } catch { /* Music is optional. */ }
  // Alternating long and short steps create swing without an audio file.
  const swingDelay = musicStep % 2 ? 370 : 230;
  musicTimer = setTimeout(playMusicNote, swingDelay);
}

export function startMusic() {
  if (!settingsProvider().music || musicTimer) return;
  playMusicNote();
}

export function stopMusic() {
  clearTimeout(musicTimer);
  musicTimer = null;
}

export function playTone(type) {
  if (settingsProvider().music) startMusic();
  if (!settingsProvider().sound) return;
  try {
    const audioContext = getAudioContext();
    const now = audioContext.currentTime;
    // Each game action maps to a tiny synthesized motif.
    const notes = {
      click: [420], deal: [240, 330], draw: [300, 390],
      lose: [230, 170], error: [130], win: [440, 554, 659, 880]
    }[type] || [300];
    notes.forEach((frequency, i) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = type === 'win' ? 'triangle' : 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001, now + i * .09);
      gain.gain.exponentialRampToValueAtTime(.065, now + i * .09 + .01);
      gain.gain.exponentialRampToValueAtTime(.0001, now + i * .09 + .13);
      osc.connect(gain).connect(audioContext.destination);
      osc.start(now + i * .09);
      osc.stop(now + i * .09 + .15);
    });
  } catch { /* Audio is optional. */ }
}
