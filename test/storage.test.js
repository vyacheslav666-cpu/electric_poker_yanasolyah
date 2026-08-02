import assert from 'node:assert/strict';
import test from 'node:test';

import { STORAGE_KEY } from '../js/config.js';
import { loadSave, saveState } from '../js/storage.js';

function useStorage(value, setItem = () => {}) {
  globalThis.localStorage = {
    getItem: key => key === STORAGE_KEY ? value : null,
    setItem
  };
}

test('invalid persisted values are sanitized', () => {
  useStorage(JSON.stringify({
    balance: -5,
    bet: 17,
    music: 'yes',
    musicTrack: 'missing',
    history: [{
      time: '<b>now</b>',
      cards: '<img src=x onerror=alert(1)>',
      result: '<script>alert(1)</script>',
      bet: -10,
      win: Number.MAX_VALUE,
      balance: -2
    }]
  }));

  const save = loadSave();
  assert.equal(save.balance, 1000);
  assert.equal(save.bet, 10);
  assert.equal(save.music, false);
  assert.equal(save.musicTrack, 'velvet-shuffle');
  assert.equal(save.history.length, 1);
  assert.equal(save.history[0].bet, 10);
  assert.equal(save.history[0].win, 1_000_000_000);
  assert.equal(save.history[0].balance, 0);
});

test('unavailable local storage never interrupts the game', () => {
  useStorage(null, () => { throw new Error('quota exceeded'); });
  assert.equal(saveState({ history: [] }), false);
});

test('fractional credits survive save loading', () => {
  useStorage(JSON.stringify({
    balance: 12.5,
    bet: 10,
    history: [{ bet: 5, rerolls: 3, win: 2.5, balance: 7.5 }]
  }));

  const save = loadSave();
  assert.equal(save.balance, 12.5);
  assert.equal(save.history[0].bet, 5);
  assert.equal(save.history[0].rerolls, 3);
  assert.equal(save.history[0].win, 2.5);
  assert.equal(save.history[0].balance, 7.5);
});
