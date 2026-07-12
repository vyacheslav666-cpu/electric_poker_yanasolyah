import { STORAGE_KEY } from './config.js';

/** Read and sanitize the browser save instead of trusting localStorage blindly. */
export function loadSave() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      balance: Number.isFinite(saved?.balance) && saved.balance >= 0 ? saved.balance : 1000,
      bet: Number.isFinite(saved?.bet) && saved.bet >= 10 ? Math.floor(saved.bet / 10) * 10 : 10,
      sound: saved?.sound !== false,
      music: saved?.music === true,
      history: Array.isArray(saved?.history) ? saved.history.slice(0, 30) : []
    };
  } catch {
    return { balance: 1000, bet: 10, sound: true, music: false, history: [] };
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
    history: state.history
  }));
}
