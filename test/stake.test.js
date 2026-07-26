import assert from 'node:assert/strict';
import test from 'node:test';

import { affordableBet } from '../js/stake.js';

test('uses the selected bet when the balance is sufficient', () => {
  assert.equal(affordableBet(12530, 1000), 1000);
});

test('uses the entire balance when the selected bet is too high', () => {
  assert.equal(affordableBet(12530, 12880), 12530);
});

test('does not allow a hand with an empty or invalid balance', () => {
  assert.equal(affordableBet(0, 100), 0);
  assert.equal(affordableBet(Number.NaN, 100), 0);
});
