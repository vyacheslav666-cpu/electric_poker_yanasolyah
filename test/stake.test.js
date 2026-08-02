import assert from 'node:assert/strict';
import test from 'node:test';

import { affordableBet, calculateWin, rerollPayoutFactor } from '../js/stake.js';

test('uses the selected bet when the balance is sufficient', () => {
  assert.equal(affordableBet(12530, 1000), 1000);
});

test('uses the entire balance when the selected bet is too high', () => {
  assert.equal(affordableBet(12530, 12880), 12530);
  assert.equal(affordableBet(2.5, 10), 2.5);
});

test('does not allow a hand with an empty or invalid balance', () => {
  assert.equal(affordableBet(0, 100), 0);
  assert.equal(affordableBet(Number.NaN, 100), 0);
});

test('fractional multipliers produce stable credit amounts', () => {
  assert.equal(calculateWin(10, 0.5), 5);
  assert.equal(calculateWin(5, 0.5), 2.5);
  assert.equal(calculateWin(2.5, 0.5), 1.25);
});

test('each replaced card reduces the payout by ten percentage points', () => {
  assert.equal(rerollPayoutFactor(0), 1);
  assert.equal(rerollPayoutFactor(1), 0.9);
  assert.equal(rerollPayoutFactor(3), 0.7);
  assert.equal(rerollPayoutFactor(7), 0.3);
  assert.equal(rerollPayoutFactor(99), 0.3);
});

test('reroll penalty is applied to the final win', () => {
  assert.equal(calculateWin(100, 7, rerollPayoutFactor(3)), 490);
  assert.equal(calculateWin(10, 0.5, rerollPayoutFactor(1)), 4.5);
});
