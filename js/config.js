/** Static card, payout and persistence configuration. */
// Keep this module free of DOM and browser APIs: both the game engine and UI
// can import the same vocabulary without depending on one another.
export const SUITS = [
  { symbol: '♠', key: 'spades', color: 'black' },
  { symbol: '♥', key: 'hearts', color: 'red' },
  { symbol: '♦', key: 'diamonds', color: 'red' },
  { symbol: '♣', key: 'clubs', color: 'black' }
];
export const RANKS = [
  { value: 2, label: '2' }, { value: 3, label: '3' }, { value: 4, label: '4' },
  { value: 5, label: '5' }, { value: 6, label: '6' }, { value: 7, label: '7' },
  { value: 8, label: '8' }, { value: 9, label: '9' }, { value: 10, label: '10' },
  { value: 11, label: 'J' }, { value: 12, label: 'Q' }, { value: 13, label: 'K' },
  { value: 14, label: 'A' }
];
// Order matters: poker.js uses the array index as combination priority.
export const PAYOUTS = [
  { key: 'royal', name: 'Флеш-рояль', multiplier: 250 },
  { key: 'straight-flush', name: 'Стрит-флеш', multiplier: 50 },
  { key: 'four', name: 'Каре', multiplier: 25 },
  { key: 'full-house', name: 'Фулл-хаус', multiplier: 9 },
  { key: 'flush', name: 'Флеш', multiplier: 6 },
  { key: 'straight', name: 'Стрит', multiplier: 4 },
  { key: 'three', name: 'Тройка', multiplier: 3 },
  { key: 'two-pair', name: 'Две пары', multiplier: 2 },
  { key: 'jacks', name: 'Валеты или лучше', multiplier: 1 }
];

// Music is generated in the browser, so every track is original, lightweight
// and available offline without shipping copyrighted audio files.
export const MUSIC_TRACKS = [
  { id: 'velvet-shuffle', title: 'Velvet Shuffle', subtitle: 'мягкий casino jazz', bpm: 104 },
  { id: 'neon-bossa', title: 'Neon Bossa', subtitle: 'ночная bossa nova', bpm: 116 },
  { id: 'midnight-drive', title: 'Midnight Drive', subtitle: 'электро-лаунж', bpm: 92 },
  { id: 'high-roller', title: 'High Roller', subtitle: 'яркий big-room swing', bpm: 132 }
];

export const CARD_THEMES = [
  { id: 'ivory', title: 'Ivory', subtitle: 'классика казино' },
  { id: 'neon', title: 'Neon', subtitle: 'тёмный киберпанк' },
  { id: 'noir', title: 'Noir', subtitle: 'чёрное золото' }
];

export const CARD_BACKS = [
  { id: 'royal', title: 'Royal' },
  { id: 'circuit', title: 'Circuit' },
  { id: 'emerald', title: 'Emerald' }
];

export const STORAGE_KEY = 'electropoker-save-v1';
