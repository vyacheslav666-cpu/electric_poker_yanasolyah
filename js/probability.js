const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const ODDS_KEYS = [
  'royal',
  'straight-flush',
  'four',
  'full-house',
  'flush',
  'straight',
  'three',
  'two-pair',
  'jacks',
  'none'
];

export const ODDS_LABELS = [
  { key: 'royal', name: 'Флеш-рояль' },
  { key: 'straight-flush', name: 'Стрит-флеш' },
  { key: 'four', name: 'Каре' },
  { key: 'full-house', name: 'Фулл-хаус' },
  { key: 'flush', name: 'Флеш' },
  { key: 'straight', name: 'Стрит' },
  { key: 'three', name: 'Тройка' },
  { key: 'two-pair', name: 'Две пары' },
  { key: 'jacks', name: 'Валеты или лучше' },
  { key: 'none', name: 'Без выигрыша' }
];

const SUIT_INDEX = new Map(SUITS.map((suit, index) => [suit, index]));
const ROYAL_MASK = 0b11111 << 8;
const WHEEL_MASK = (1 << 12) | 0b1111;
const EXACT_OUTCOME_LIMIT = 1_300_000;
const DEFAULT_SAMPLE_SIZE = 200_000;

function choose(total, selected) {
  if (selected < 0 || selected > total) return 0;
  const count = Math.min(selected, total - selected);
  let result = 1;
  for (let index = 1; index <= count; index++) {
    result = result * (total - count + index) / index;
  }
  return Math.round(result);
}

function cardCode(card) {
  const suit = SUIT_INDEX.get(card.key);
  if (!Number.isInteger(suit) || card.value < 2 || card.value > 14) {
    throw new Error('Некорректная карта в расчёте вероятностей.');
  }
  return suit * 13 + card.value - 2;
}

function buildDeck() {
  const deck = [];
  for (let suit = 0; suit < SUITS.length; suit++) {
    for (let rank = 0; rank < 13; rank++) {
      deck.push({ suit, rank, bit: 1 << rank, code: suit * 13 + rank });
    }
  }
  return deck;
}

function makeSummary() {
  return {
    rankCounts: new Uint8Array(13),
    suitCounts: new Uint8Array(4),
    suitRankCounts: Array.from({ length: 4 }, () => new Uint8Array(13)),
    suitMasks: new Uint16Array(4),
    rankMask: 0
  };
}

function addCard(summary, card) {
  if (summary.rankCounts[card.rank]++ === 0) summary.rankMask |= card.bit;
  summary.suitCounts[card.suit]++;
  if (summary.suitRankCounts[card.suit][card.rank]++ === 0) {
    summary.suitMasks[card.suit] |= card.bit;
  }
}

function removeCard(summary, card) {
  if (--summary.rankCounts[card.rank] === 0) summary.rankMask &= ~card.bit;
  summary.suitCounts[card.suit]--;
  if (--summary.suitRankCounts[card.suit][card.rank] === 0) {
    summary.suitMasks[card.suit] &= ~card.bit;
  }
}

function hasStraight(mask) {
  if ((mask & WHEEL_MASK) === WHEEL_MASK) return true;
  for (let start = 0; start <= 8; start++) {
    const windowMask = 0b11111 << start;
    if ((mask & windowMask) === windowMask) return true;
  }
  return false;
}

function classifySummary(summary) {
  for (let suit = 0; suit < 4; suit++) {
    if ((summary.suitMasks[suit] & ROYAL_MASK) === ROYAL_MASK) return 'royal';
  }

  for (let suit = 0; suit < 4; suit++) {
    if (summary.suitCounts[suit] >= 5 && hasStraight(summary.suitMasks[suit])) {
      return 'straight-flush';
    }
  }

  let pairRanks = 0;
  let tripleRanks = 0;
  for (let rank = 0; rank < 13; rank++) {
    const count = summary.rankCounts[rank];
    if (count === 4) return 'four';
    if (count >= 3) tripleRanks++;
    if (count >= 2) pairRanks++;
  }

  if (tripleRanks >= 1 && pairRanks >= 2) return 'full-house';
  if (summary.suitCounts.some(count => count >= 5)) return 'flush';
  if (hasStraight(summary.rankMask)) return 'straight';
  if (tripleRanks >= 1) return 'three';
  if (pairRanks >= 2) return 'two-pair';

  for (let rank = 9; rank < 13; rank++) {
    if (summary.rankCounts[rank] >= 2) return 'jacks';
  }
  return 'none';
}

export function classifySevenFast(hand) {
  if (!Array.isArray(hand) || hand.length !== 7) {
    throw new Error('Для оценки нужна рука из семи карт.');
  }
  const summary = makeSummary();
  hand.forEach(card => {
    const code = cardCode(card);
    addCard(summary, { suit: Math.floor(code / 13), rank: code % 13, bit: 1 << (code % 13), code });
  });
  return classifySummary(summary);
}

function seedFromState(hand, selected) {
  const markedCodes = hand
    .map((card, index) => cardCode(card) + (selected[index] ? 64 : 0))
    .sort((a, b) => a - b);
  let hash = 2166136261;
  markedCodes.forEach(code => {
    hash ^= code + 1;
    hash = Math.imul(hash, 16777619);
  });
  return hash >>> 0;
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ result >>> 15, result | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

function makeCounts() {
  return Object.fromEntries(ODDS_KEYS.map(key => [key, 0]));
}

function exactCounts(summary, pool, drawCount, counts) {
  function visit(start, depth) {
    if (depth === drawCount) {
      counts[classifySummary(summary)]++;
      return;
    }
    const remaining = drawCount - depth;
    for (let index = start; index <= pool.length - remaining; index++) {
      addCard(summary, pool[index]);
      visit(index + 1, depth + 1);
      removeCard(summary, pool[index]);
    }
  }
  visit(0, 0);
}

function sampledCounts(summary, pool, drawCount, counts, sampleSize, seed) {
  const random = mulberry32(seed);
  const order = Array.from({ length: pool.length }, (_, index) => index);
  const swaps = new Uint8Array(drawCount);

  for (let sample = 0; sample < sampleSize; sample++) {
    for (let position = 0; position < drawCount; position++) {
      const target = position + Math.floor(random() * (pool.length - position));
      swaps[position] = target;
      [order[position], order[target]] = [order[target], order[position]];
      addCard(summary, pool[order[position]]);
    }

    counts[classifySummary(summary)]++;

    for (let position = drawCount - 1; position >= 0; position--) {
      removeCard(summary, pool[order[position]]);
      const target = swaps[position];
      [order[position], order[target]] = [order[target], order[position]];
    }
  }
}

export function calculateHandOdds({ hand, selected, sampleSize = DEFAULT_SAMPLE_SIZE }) {
  if (!Array.isArray(hand) || hand.length !== 7) {
    throw new Error('Для оценки нужна рука из семи карт.');
  }
  if (!Array.isArray(selected) || selected.length !== 7) {
    throw new Error('Неизвестно, какие карты заменяются.');
  }

  const selectedFlags = selected.map(Boolean);
  const drawCount = selectedFlags.filter(Boolean).length;
  const visibleCodes = new Set(hand.map(cardCode));
  if (visibleCodes.size !== 7) throw new Error('В руке не должно быть повторяющихся карт.');

  const deck = buildDeck();
  const pool = deck.filter(card => !visibleCodes.has(card.code));
  const summary = makeSummary();

  hand.forEach((card, index) => {
    if (selectedFlags[index]) return;
    const code = cardCode(card);
    addCard(summary, deck[code]);
  });

  const totalOutcomes = choose(pool.length, drawCount);
  const exact = totalOutcomes <= EXACT_OUTCOME_LIMIT;
  const requestedSamples = Number.isFinite(sampleSize) ? Math.floor(sampleSize) : DEFAULT_SAMPLE_SIZE;
  const evaluatedOutcomes = exact
    ? totalOutcomes
    : Math.max(10_000, Math.min(1_000_000, requestedSamples));
  const counts = makeCounts();

  if (exact) {
    exactCounts(summary, pool, drawCount, counts);
  } else {
    sampledCounts(
      summary,
      pool,
      drawCount,
      counts,
      evaluatedOutcomes,
      seedFromState(hand, selectedFlags)
    );
  }

  const counted = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (counted !== evaluatedOutcomes) {
    throw new Error('Расчёт вероятностей завершился некорректно.');
  }

  const probabilities = Object.fromEntries(
    ODDS_KEYS.map(key => [key, counts[key] / evaluatedOutcomes])
  );

  return {
    exact,
    drawCount,
    totalOutcomes,
    evaluatedOutcomes,
    counts,
    probabilities,
    winProbability: 1 - probabilities.none
  };
}
