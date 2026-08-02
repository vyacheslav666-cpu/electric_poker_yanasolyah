import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { PAYOUTS } from '../js/config.js';

const multipliers = Object.fromEntries(
  PAYOUTS.map(({ key, multiplier }) => [key, multiplier])
);

test('weaker made hands use the rebalanced payouts', () => {
  assert.equal(multipliers.jacks, 0.5);
  assert.equal(multipliers['two-pair'], 1);
  assert.equal(multipliers.three, 2);
  assert.equal(multipliers['full-house'], 7);
});

test('premium hand payouts remain unchanged', () => {
  assert.equal(multipliers.four, 25);
  assert.equal(multipliers['straight-flush'], 50);
  assert.equal(multipliers.royal, 250);
});

test('payouts stay ordered from strongest to weakest', () => {
  for (let index = 1; index < PAYOUTS.length; index++) {
    assert.ok(
      PAYOUTS[index - 1].multiplier >= PAYOUTS[index].multiplier,
      `${PAYOUTS[index - 1].key} must not pay less than ${PAYOUTS[index].key}`
    );
  }
});

test('help dialog shows the configured payout multipliers', () => {
  const html = readFileSync('index.html', 'utf8');
  PAYOUTS.forEach(({ name, multiplier }) => {
    assert.match(html, new RegExp(`<strong>${name}</strong><b>×${multiplier}</b>`));
  });
});
