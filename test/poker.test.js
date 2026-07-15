import assert from 'node:assert/strict';
import test from 'node:test';

import { makeDeck, evaluateSeven, shuffle } from '../js/poker.js';
import { classifySevenFast } from '../js/probability.js';

const suitSymbols = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
const suitColors = { spades: 'black', hearts: 'red', diamonds: 'red', clubs: 'black' };

function card(value, key) {
  return {
    value,
    label: value === 14 ? 'A' : value === 13 ? 'K' : value === 12 ? 'Q' : value === 11 ? 'J' : String(value),
    key,
    symbol: suitSymbols[key],
    color: suitColors[key]
  };
}

const hands = [
  ['royal', [card(10, 'hearts'), card(11, 'hearts'), card(12, 'hearts'), card(13, 'hearts'), card(14, 'hearts'), card(2, 'clubs'), card(4, 'spades')]],
  ['straight-flush', [card(5, 'clubs'), card(6, 'clubs'), card(7, 'clubs'), card(8, 'clubs'), card(9, 'clubs'), card(13, 'hearts'), card(14, 'spades')]],
  ['four', [card(9, 'clubs'), card(9, 'diamonds'), card(9, 'hearts'), card(9, 'spades'), card(2, 'clubs'), card(5, 'hearts'), card(14, 'spades')]],
  ['full-house', [card(14, 'clubs'), card(14, 'diamonds'), card(14, 'hearts'), card(13, 'clubs'), card(13, 'spades'), card(3, 'hearts'), card(6, 'clubs')]],
  ['flush', [card(2, 'spades'), card(5, 'spades'), card(8, 'spades'), card(11, 'spades'), card(13, 'spades'), card(4, 'hearts'), card(9, 'clubs')]],
  ['straight', [card(5, 'clubs'), card(6, 'diamonds'), card(7, 'hearts'), card(8, 'spades'), card(9, 'clubs'), card(13, 'hearts'), card(14, 'spades')]],
  ['three', [card(8, 'clubs'), card(8, 'diamonds'), card(8, 'hearts'), card(2, 'spades'), card(5, 'clubs'), card(11, 'hearts'), card(14, 'spades')]],
  ['two-pair', [card(8, 'clubs'), card(8, 'diamonds'), card(4, 'hearts'), card(4, 'spades'), card(2, 'clubs'), card(11, 'hearts'), card(14, 'spades')]],
  ['jacks', [card(11, 'clubs'), card(11, 'diamonds'), card(2, 'hearts'), card(5, 'spades'), card(8, 'clubs'), card(10, 'hearts'), card(14, 'spades')]],
  [null, [card(10, 'clubs'), card(10, 'diamonds'), card(2, 'hearts'), card(5, 'spades'), card(7, 'clubs'), card(9, 'hearts'), card(14, 'spades')]]
];

test('standard deck contains 52 unique cards', () => {
  const deck = makeDeck();
  assert.equal(deck.length, 52);
  assert.equal(new Set(deck.map(item => `${item.value}-${item.key}`)).size, 52);
  assert.equal(shuffle(deck), deck);
  assert.equal(new Set(deck.map(item => `${item.value}-${item.key}`)).size, 52);
});

for (const [expected, hand] of hands) {
  test(`classifies ${expected ?? 'a non-paying hand'}`, () => {
    assert.equal(evaluateSeven(hand)?.payout.key ?? null, expected);
    assert.equal(classifySevenFast(hand), expected ?? 'none');
  });
}

test('ace can play low in a straight', () => {
  const hand = [card(14, 'clubs'), card(2, 'diamonds'), card(3, 'hearts'), card(4, 'spades'), card(5, 'clubs'), card(9, 'hearts'), card(12, 'spades')];
  assert.equal(evaluateSeven(hand)?.payout.key, 'straight');
});
