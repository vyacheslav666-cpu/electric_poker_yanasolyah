import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateHandOdds } from '../js/probability.js';

function card(value, key) {
  return { value, key };
}

const hand = [
  card(11, 'clubs'), card(11, 'diamonds'), card(2, 'hearts'), card(5, 'spades'),
  card(8, 'clubs'), card(10, 'hearts'), card(14, 'spades')
];

test('current hand has one exact outcome', () => {
  const result = calculateHandOdds({ hand, selected: Array(7).fill(false) });
  assert.equal(result.exact, true);
  assert.equal(result.totalOutcomes, 1);
  assert.equal(result.counts.jacks, 1);
  assert.equal(result.winProbability, 1);
});

test('one-card redraw enumerates all remaining cards', () => {
  const result = calculateHandOdds({ hand, selected: [false, false, true, false, false, false, false] });
  assert.equal(result.exact, true);
  assert.equal(result.totalOutcomes, 45);
  assert.equal(Object.values(result.counts).reduce((sum, count) => sum + count, 0), 45);
  assert.ok(result.winProbability >= 0 && result.winProbability <= 1);
});

test('large redraw simulations are deterministic for the same hand', () => {
  const input = { hand, selected: Array(7).fill(true), sampleSize: 10_000 };
  const first = calculateHandOdds(input);
  const second = calculateHandOdds(input);
  assert.equal(first.exact, false);
  assert.deepEqual(first.counts, second.counts);
  assert.equal(Object.values(first.counts).reduce((sum, count) => sum + count, 0), 10_000);
});

test('duplicate cards are rejected', () => {
  const duplicateHand = [...hand.slice(0, 6), hand[0]];
  assert.throws(
    () => calculateHandOdds({ hand: duplicateHand, selected: Array(7).fill(false) }),
    /повторяющихся карт/
  );
});
