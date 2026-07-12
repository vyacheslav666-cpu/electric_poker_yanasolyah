import { PAYOUTS, RANKS, SUITS } from './config.js';

/** Create a standard 52-card deck from shared rank and suit configuration. */
export function makeDeck() {
  return SUITS.flatMap(suit => RANKS.map(rank => ({ ...rank, ...suit })));
}

export function shuffle(deck) {
  // In-place Fisher-Yates: callers receive the same deck object in random order.
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}


/** Classify one exact five-card poker hand. */
function evaluateFive(hand) {
  const values = hand.map(card => card.value).sort((a, b) => a - b);
  const counts = new Map();
  values.forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
  const groups = [...counts.values()].sort((a, b) => b - a);
  const flush = hand.every(card => card.key === hand[0].key);
  const unique = [...new Set(values)];
  // A-2-3-4-5 is the only straight where an ace acts below a two.
  const wheel = unique.join(',') === '2,3,4,5,14';
  const straight = unique.length === 5 && (wheel || unique[4] - unique[0] === 4);
  const royal = flush && values.join(',') === '10,11,12,13,14';

  if (royal) return PAYOUTS[0];
  if (straight && flush) return PAYOUTS[1];
  if (groups[0] === 4) return PAYOUTS[2];
  if (groups[0] === 3 && groups[1] === 2) return PAYOUTS[3];
  if (flush) return PAYOUTS[4];
  if (straight) return PAYOUTS[5];
  if (groups[0] === 3) return PAYOUTS[6];
  if (groups[0] === 2 && groups[1] === 2) return PAYOUTS[7];
  const payingPair = [...counts].some(([value, count]) => count === 2 && value >= 11);
  if (payingPair) return PAYOUTS[8];
  return null;
}

/** Test all 21 five-card subsets and return the strongest result. */
export function evaluateSeven(hand) {
  let best = null;
  for (let a = 0; a < hand.length - 4; a++) {
    for (let b = a + 1; b < hand.length - 3; b++) {
      for (let c = b + 1; c < hand.length - 2; c++) {
        for (let d = c + 1; d < hand.length - 1; d++) {
          for (let e = d + 1; e < hand.length; e++) {
            const indices = [a, b, c, d, e];
            const payout = evaluateFive(indices.map(index => hand[index]));
            if (!payout) continue;
            // PAYOUTS is ordered strongest-first, so a lower index always wins.
            const priority = PAYOUTS.findIndex(item => item.key === payout.key);
            if (!best || priority < best.priority) best = { payout, priority, indices };
          }
        }
      }
    }
  }
  return best;
}

/**
 * Build UI hints for an already-made hand and likely redraw candidates.
 * This is intentionally a readable heuristic, not a claim of optimal poker play.
 */
export function analyzeHandHints(hand) {
  const rankGroups = new Map();
  hand.forEach((card, index) => {
    if (!rankGroups.has(card.value)) rankGroups.set(card.value, []);
    rankGroups.get(card.value).push(index);
  });
  const evaluated = evaluateSeven(hand);
  let made = null;

  // First preserve cards that already form a visible made combination.
  if (evaluated) {
    const key = evaluated.payout.key;
    let indices = evaluated.indices;
    if (key === 'four') indices = [...rankGroups.values()].find(group => group.length === 4);
    if (key === 'three') indices = [...rankGroups.values()].find(group => group.length === 3);
    if (key === 'two-pair') {
      indices = [...rankGroups.entries()]
        .filter(([, group]) => group.length >= 2)
        .sort((a, b) => b[0] - a[0])
        .slice(0, 2)
        .flatMap(([, group]) => group.slice(0, 2));
    }
    if (key === 'jacks') {
      indices = [...rankGroups.entries()]
        .filter(([value, group]) => value >= 11 && group.length >= 2)
        .sort((a, b) => b[0] - a[0])[0][1].slice(0, 2);
    }
    made = { name: key === 'jacks' ? 'Пара' : evaluated.payout.name, indices };
  } else {
    const pair = [...rankGroups.entries()]
      .filter(([, group]) => group.length >= 2)
      .sort((a, b) => b[0] - a[0])[0];
    if (pair) made = { name: 'Пара', indices: pair[1].slice(0, 2) };
  }

  let keep = made ? [...made.indices] : [];
  let plan = made ? `Собрано: ${made.name}` : '';

  // Without a made hand, compare simple flush/straight draws and high cards.
  if (!made) {
    const suits = new Map();
    hand.forEach((card, index) => {
      if (!suits.has(card.key)) suits.set(card.key, []);
      suits.get(card.key).push(index);
    });
    const flushDraw = [...suits.values()].sort((a, b) => b.length - a.length)[0];

    const windows = [[14, 2, 3, 4, 5]];
    for (let start = 2; start <= 10; start++) windows.push([start, start + 1, start + 2, start + 3, start + 4]);
    let straightKeep = [];
    windows.forEach(windowValues => {
      const candidate = [];
      windowValues.forEach(value => {
        const group = rankGroups.get(value);
        if (group) candidate.push(group[0]);
      });
      if (candidate.length > straightKeep.length) straightKeep = candidate;
    });

    if (flushDraw.length >= 3 && flushDraw.length > straightKeep.length) {
      keep = flushDraw;
      plan = `Шанс на флеш: ${keep.length} из 5`;
    } else if (straightKeep.length >= 3) {
      keep = straightKeep;
      plan = `Шанс на стрит: ${keep.length} из 5`;
    } else {
      keep = hand
        .map((card, index) => ({ card, index }))
        .filter(item => item.card.value >= 11)
        .sort((a, b) => b.card.value - a.card.value)
        .slice(0, 2)
        .map(item => item.index);
      if (!keep.length) keep = [hand.reduce((best, card, index) => card.value > hand[best].value ? index : best, 0)];
      plan = 'Попробуй собрать пару';
    }
  }

  const keepSet = new Set(keep);
  return {
    madeIndices: made?.indices || [],
    // Retained as engine output for a future optional strategy UI. The current
    // interface deliberately highlights only made combinations in green.
    suggestedIndices: hand.map((_, index) => index).filter(index => !keepSet.has(index)),
    label: plan
  };
}
