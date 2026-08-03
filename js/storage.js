import { CARD_BACKS, CARD_THEMES, MUSIC_TRACKS, STORAGE_KEY, TABLE_THEMES } from './config.js';

const DEFAULT_MUSIC_TRACK = MUSIC_TRACKS[0].id;
const MUSIC_TRACK_IDS = new Set(MUSIC_TRACKS.map(track => track.id));
const DEFAULT_CARD_THEME = CARD_THEMES[0].id;
const CARD_THEME_IDS = new Set(CARD_THEMES.map(theme => theme.id));
const DEFAULT_CARD_BACK = CARD_BACKS[0].id;
const CARD_BACK_IDS = new Set(CARD_BACKS.map(theme => theme.id));
const DEFAULT_TABLE_THEME = TABLE_THEMES[0].id;
const TABLE_THEME_IDS = new Set(TABLE_THEMES.map(theme => theme.id));
const MAX_CREDITS = 1_000_000_000;
const MAX_BET = 1_000_000;

function defaultSave() {
  return {
    balance: 1000,
    bet: 10,
    sound: true,
    music: false,
    musicTrack: DEFAULT_MUSIC_TRACK,
    cardTheme: DEFAULT_CARD_THEME,
    cardBack: DEFAULT_CARD_BACK,
    tableTheme: DEFAULT_TABLE_THEME,
    history: []
  };
}

function safeCredits(value, fallback, minimum = 0, maximum = MAX_CREDITS) {
  if (!Number.isFinite(value)) return fallback;
  const bounded = Math.min(maximum, Math.max(minimum, value));
  return Math.round(bounded * 100) / 100;
}

function safeText(value, maximumLength) {
  return typeof value === 'string' ? value.slice(0, maximumLength) : '';
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(game => game && typeof game === 'object')
    .slice(0, 30)
    .map(game => ({
      time: safeText(game.time, 40),
      cards: safeText(game.cards, 80),
      result: safeText(game.result, 60) || 'Без комбинации',
      bet: Number.isFinite(game.bet) && game.bet > 0
        ? safeCredits(game.bet, 10, 0.01, MAX_BET)
        : 10,
      win: safeCredits(game.win, 0),
      balance: safeCredits(game.balance, 0)
    }));
}

/** Read and sanitize the browser save instead of trusting localStorage blindly. */
export function loadSave() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      balance: Number.isFinite(saved?.balance) && saved.balance >= 0
        ? safeCredits(saved.balance, 1000)
        : 1000,
      bet: Math.floor(safeCredits(saved?.bet, 10, 10, MAX_BET) / 10) * 10,
      sound: saved?.sound !== false,
      music: saved?.music === true,
      musicTrack: MUSIC_TRACK_IDS.has(saved?.musicTrack) ? saved.musicTrack : DEFAULT_MUSIC_TRACK,
      cardTheme: CARD_THEME_IDS.has(saved?.cardTheme) ? saved.cardTheme : DEFAULT_CARD_THEME,
      cardBack: CARD_BACK_IDS.has(saved?.cardBack) ? saved.cardBack : DEFAULT_CARD_BACK,
      tableTheme: TABLE_THEME_IDS.has(saved?.tableTheme) ? saved.tableTheme : DEFAULT_TABLE_THEME,
      history: sanitizeHistory(saved?.history)
    };
  } catch {
    return defaultSave();
  }
}

export function saveState(state) {
  // Transient data (deck, selected cards and animation locks) must not survive
  // a reload; only stable player progress and preferences are persisted.
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      balance: state.balance,
      bet: state.bet,
      sound: state.sound,
      music: state.music,
      musicTrack: state.musicTrack,
      cardTheme: state.cardTheme,
      cardBack: state.cardBack,
      tableTheme: state.tableTheme,
      history: state.history
    }));
    return true;
  } catch {
    // Private browsing policies and full storage quotas must not stop a round.
    return false;
  }
}
