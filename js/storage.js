import { CARD_BACKS, CARD_THEMES, MUSIC_TRACKS, STORAGE_KEY } from './config.js';

const DEFAULT_MUSIC_TRACK = MUSIC_TRACKS[0].id;
const MUSIC_TRACK_IDS = new Set(MUSIC_TRACKS.map(track => track.id));
const DEFAULT_CARD_THEME = CARD_THEMES[0].id;
const CARD_THEME_IDS = new Set(CARD_THEMES.map(theme => theme.id));
const DEFAULT_CARD_BACK = CARD_BACKS[0].id;
const CARD_BACK_IDS = new Set(CARD_BACKS.map(theme => theme.id));

/** Read and sanitize the browser save instead of trusting localStorage blindly. */
export function loadSave() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      balance: Number.isFinite(saved?.balance) && saved.balance >= 0 ? saved.balance : 1000,
      bet: Number.isFinite(saved?.bet) && saved.bet >= 10 ? Math.floor(saved.bet / 10) * 10 : 10,
      sound: saved?.sound !== false,
      music: saved?.music === true,
      musicTrack: MUSIC_TRACK_IDS.has(saved?.musicTrack) ? saved.musicTrack : DEFAULT_MUSIC_TRACK,
      cardTheme: CARD_THEME_IDS.has(saved?.cardTheme) ? saved.cardTheme : DEFAULT_CARD_THEME,
      cardBack: CARD_BACK_IDS.has(saved?.cardBack) ? saved.cardBack : DEFAULT_CARD_BACK,
      history: Array.isArray(saved?.history) ? saved.history.slice(0, 30) : []
    };
  } catch {
    return {
      balance: 1000, bet: 10, sound: true, music: false,
      musicTrack: DEFAULT_MUSIC_TRACK, cardTheme: DEFAULT_CARD_THEME,
      cardBack: DEFAULT_CARD_BACK, history: []
    };
  }
}

export function saveState(state) {
  // Transient data (deck, selected cards and animation locks) must not survive
  // a reload; only stable player progress and preferences are persisted.
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    balance: state.balance,
    bet: state.bet,
    sound: state.sound,
    music: state.music,
    musicTrack: state.musicTrack,
    cardTheme: state.cardTheme,
    cardBack: state.cardBack,
    history: state.history
  }));
}
