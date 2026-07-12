/**
 * Application controller and DOM renderer.
 *
 * `state` is the single source of truth for the current session. Poker rules,
 * persistence and sound stay in separate modules so they do not depend on DOM.
 */
import { CARD_BACKS, CARD_THEMES, MUSIC_TRACKS, PAYOUTS, TABLE_THEMES } from './config.js';
import { configureAudio, playTone, setMusicTrack, startMusic, stopMusic } from './audio.js';
import { analyzeHandHints, evaluateSeven, makeDeck, shuffle } from './poker.js';
import { loadSave, saveState } from './storage.js';
// Cache the DOM once; render functions update these nodes throughout a round.
const els = {
  cards: document.querySelector('#cards'),
  cabinet: document.querySelector('.cabinet'),
  balance: document.querySelector('#balance'),
  topBet: document.querySelector('#topBet'),
  win: document.querySelector('#win'),
  bet: document.querySelector('#bet'),
  message: document.querySelector('#message'),
  mainButton: document.querySelector('#mainButton'),
  betDown: document.querySelector('#betDown'),
  betUp: document.querySelector('#betUp'),
  betHalf: document.querySelector('#betHalf'),
  betDouble: document.querySelector('#betDouble'),
  paytable: document.querySelector('#paytable'),
  helpButton: document.querySelector('#helpButton'),
  helpDialog: document.querySelector('#helpDialog'),
  closeHelp: document.querySelector('#closeHelp'),
  historyButton: document.querySelector('#historyButton'),
  historyDialog: document.querySelector('#historyDialog'),
  historyList: document.querySelector('#historyList'),
  closeHistory: document.querySelector('#closeHistory'),
  settingsButton: document.querySelector('#settingsButton'),
  settingsDialog: document.querySelector('#settingsDialog'),
  closeSettings: document.querySelector('#closeSettings'),
  soundButton: document.querySelector('#soundButton'),
  musicButton: document.querySelector('#musicButton'),
  musicState: document.querySelector('#musicState'),
  soundState: document.querySelector('#soundState'),
  previousTrack: document.querySelector('#previousTrack'),
  nextTrack: document.querySelector('#nextTrack'),
  trackCounter: document.querySelector('#trackCounter'),
  trackTitle: document.querySelector('#trackTitle'),
  trackSubtitle: document.querySelector('#trackSubtitle'),
  equalizer: document.querySelector('#equalizer'),
  cardThemeChoices: [...document.querySelectorAll('[data-card-theme-choice]')],
  cardBackChoices: [...document.querySelectorAll('[data-card-back-choice]')],
  tableThemeChoices: [...document.querySelectorAll('[data-table-theme-choice]')],
  resetButton: document.querySelector('#resetButton'),
  depositButton: document.querySelector('#depositButton'),
  utilityDock: document.querySelector('#utilityDock'),
  utilityToggle: document.querySelector('#utilityToggle'),
  utilityActions: document.querySelector('#utilityActions'),
  toast: document.querySelector('#toast')
};

const loaded = loadSave();

// The UI is driven by three round phases: ready -> holding -> result.
// `busy` temporarily locks input while deal/redraw animations are running.
const state = {
  phase: 'ready',
  balance: loaded.balance,
  bet: loaded.bet,
  sound: loaded.sound,
  music: loaded.music,
  musicTrack: loaded.musicTrack,
  cardTheme: loaded.cardTheme,
  cardBack: loaded.cardBack,
  tableTheme: loaded.tableTheme,
  deck: [],
  hand: [],
  selected: Array(7).fill(false),
  handHint: null,
  lastWin: 0,
  resultKey: null,
  winningIndices: [],
  history: loaded.history,
  busy: false
};

// Audio reads the current toggles without owning application state.
configureAudio(() => state);

function save() { saveState(state); }
function draw() { return state.deck.pop(); }

// Kept optional: older layouts had a permanent paytable, while the current
// compact layout exposes the same information inside the help dialog.
function buildPaytable() {
  if (!els.paytable) return;
  els.paytable.innerHTML = PAYOUTS.map(item => `
    <div class="pay-row" data-pay-key="${item.key}">
      <span>${item.name}</span><strong>${item.multiplier}×</strong>
    </div>`).join('');
}

// Render the seven-card hand for ready, selection and result states.
function renderCards(animate = false, animatedIndices = null) {
  els.cards.innerHTML = '';
  for (let index = 0; index < 7; index++) {
    const card = state.hand[index];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'card-slot';
    if (card && state.phase === 'holding' && !state.busy) button.classList.add('active');
    if (card && state.phase === 'holding' && state.handHint?.madeIndices.includes(index) && !state.selected[index]) button.classList.add('made-combo');
    if (state.selected[index]) button.classList.add('selected');
    if (animate && (!animatedIndices || animatedIndices.includes(index))) {
      button.classList.add(animatedIndices ? 'redrawing' : 'dealing');
      button.style.animationDelay = `${index * 70}ms`;
    }
    if (state.phase === 'result' && state.winningIndices.includes(index)) {
      button.classList.add('winner');
      button.style.setProperty('--win-delay', `${state.winningIndices.indexOf(index) * 90}ms`);
    }
    button.dataset.index = index;
    button.setAttribute('aria-label', card ? `${card.label} ${card.symbol}${state.selected[index] ? ', заменить' : ''}` : 'Закрытая карта');
    button.setAttribute('aria-pressed', state.selected[index] ? 'true' : 'false');

    if (!card) {
      button.innerHTML = '<span class="card-back" aria-hidden="true"></span>';
    } else {
      button.innerHTML = `<span class="card-face ${card.color}">
        <span class="card-rank">${card.label}<small>${card.symbol}</small></span>
        <span class="card-suit" aria-hidden="true">${card.symbol}</span>
      </span>`;
    }
    els.cards.append(button);
  }
}

function render() {
  const bet = state.bet;
  const trackIndex = Math.max(0, MUSIC_TRACKS.findIndex(track => track.id === state.musicTrack));
  const track = MUSIC_TRACKS[trackIndex];
  els.balance.textContent = state.balance.toLocaleString('ru-RU');
  els.bet.textContent = bet;
  els.topBet.textContent = bet;
  els.win.textContent = state.lastWin.toLocaleString('ru-RU');
  els.musicButton.setAttribute('aria-pressed', String(state.music));
  els.soundButton.setAttribute('aria-pressed', String(state.sound));
  els.musicState.textContent = state.music ? 'Вкл.' : 'Выкл.';
  els.soundState.textContent = state.sound ? 'Вкл.' : 'Выкл.';
  els.trackCounter.textContent = `${String(trackIndex + 1).padStart(2, '0')} / ${String(MUSIC_TRACKS.length).padStart(2, '0')}`;
  els.trackTitle.textContent = track.title;
  els.trackSubtitle.textContent = `${track.subtitle} · ${track.bpm} BPM`;
  els.equalizer.classList.toggle('playing', state.music);
  document.body.dataset.cardTheme = state.cardTheme;
  document.body.dataset.cardBack = state.cardBack;
  document.body.dataset.tableTheme = state.tableTheme;
  els.cardThemeChoices.forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.cardThemeChoice === state.cardTheme));
  });
  els.cardBackChoices.forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.cardBackChoice === state.cardBack));
  });
  els.tableThemeChoices.forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.tableThemeChoice === state.tableTheme));
  });
  els.betDown.disabled = state.phase === 'holding' || state.busy || state.bet <= 10;
  els.betHalf.disabled = state.phase === 'holding' || state.busy || state.bet <= 10;
  els.betUp.disabled = state.phase === 'holding' || state.busy;
  els.betDouble.disabled = state.phase === 'holding' || state.busy;
  els.mainButton.disabled = state.busy;
  const selectedCount = state.selected.filter(Boolean).length;
  const shuffleMode = state.phase === 'holding';
  els.mainButton.classList.toggle('shuffle-mode', shuffleMode);
  els.mainButton.classList.toggle('deal-mode', !shuffleMode);
  els.mainButton.textContent = shuffleMode
    ? `Перетусовать${selectedCount ? ` · ${selectedCount}` : ''}`
    : 'Раздать 7 карт';
  document.querySelectorAll('.pay-row').forEach(row => row.classList.toggle('current', row.dataset.payKey === state.resultKey));
}

// A result key becomes a CSS class on the cabinet, allowing every winning
// combination to have its own colour and animation without branching in JS.
function setMessage(text, kind = '') {
  els.message.textContent = text;
  els.message.className = `message${kind ? ` ${kind}` : ''}`;
  els.cabinet.classList.toggle('jackpot', kind === 'win');
  PAYOUTS.forEach(item => {
    els.cabinet.classList.toggle(`result-${item.key}`, kind === 'win' && state.resultKey === item.key);
  });
}

function setWinMessage(name, points) {
  setMessage('', 'win');
  const title = document.createElement('strong');
  title.className = 'combo-name';
  title.textContent = name;
  const score = document.createElement('span');
  score.className = 'combo-points';
  score.textContent = `+${points} очков`;
  els.message.append(title, score);
}

// History is rendered only when the dialog opens; it is not part of every
// animation frame or card-selection update.
function renderHistory() {
  if (!state.history.length) {
    els.historyList.innerHTML = '<p class="history-empty">Пока ни одной завершённой партии.</p>';
    return;
  }
  els.historyList.innerHTML = state.history.map(game => `
    <article class="history-item">
      <div>
        <div class="history-result ${game.win > 0 ? 'won' : ''}">${game.result}</div>
        <div class="history-meta">${game.time} · ставка ${game.bet} · баланс ${game.balance}</div>
      </div>
      <div class="history-money">${game.win > 0 ? `+${game.win}` : '—'}</div>
      <div class="history-cards">${game.cards}</div>
    </article>`).join('');
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// Round state: ready → holding → result.
async function startHand() {
  const bet = state.bet;
  if (state.balance < bet) {
    showToast('Не хватает кредитов. Сбросьте прогресс или уменьшите ставку.');
    playTone('error');
    return;
  }
  state.busy = true;
  state.phase = 'holding';
  state.balance -= bet;
  state.lastWin = 0;
  state.resultKey = null;
  state.selected.fill(false);
  state.winningIndices = [];
  state.deck = shuffle(makeDeck());
  state.hand = Array.from({ length: 7 }, draw);
  state.handHint = analyzeHandHints(state.hand);
  setMessage(state.handHint.label, state.handHint.madeIndices.length ? 'made-hint' : '');
  renderCards(true);
  render();
  playTone('deal');
  save();
  await delay(470);
  state.busy = false;
  renderCards(false);
  render();
}

// Only selected cards leave the hand. The poker engine then checks every
// possible five-card subset and returns the strongest paying combination.
async function finishHand() {
  state.busy = true;
  state.handHint = null;
  render();
  const replaced = [];
  state.hand = state.hand.map((card, index) => {
    if (!state.selected[index]) return card;
    replaced.push(index);
    return draw();
  });
  state.selected.fill(false);
  renderCards(true, replaced);
  playTone('draw');
  await delay(Math.max(320, replaced.length * 75));

  const result = evaluateSeven(state.hand);
  state.phase = 'result';
  state.resultKey = result?.payout.key || null;
  state.winningIndices = result?.indices || [];
  if (result) {
    state.lastWin = result.payout.multiplier * state.bet;
    state.balance += state.lastWin;
    setWinMessage(result.payout.name, state.lastWin);
    if (navigator.vibrate) navigator.vibrate([55, 35, 70, 35, 110]);
    playTone('win');
  } else {
    state.lastWin = 0;
    setMessage('Комбинации нет', 'lose');
    playTone('lose');
  }
  state.history.unshift({
    time: new Date().toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
    cards: state.hand.map(card => `${card.label}${card.symbol}`).join('  '),
    result: result?.payout.name || 'Без комбинации',
    bet: state.bet,
    win: state.lastWin,
    balance: state.balance
  });
  state.history = state.history.slice(0, 30);
  state.busy = false;
  renderCards(false);
  render();
  save();
}

function toggleHold(index) {
  if (state.phase !== 'holding' || state.busy || !state.hand[index]) return;
  state.selected[index] = !state.selected[index];
  if (navigator.vibrate) navigator.vibrate(18);
  playTone('click');
  renderCards(false);
  const selectedCount = state.selected.filter(Boolean).length;
  setMessage(
    selectedCount ? `Для замены выбрано: ${selectedCount}` : state.handHint.label,
    selectedCount ? '' : state.handHint.madeIndices.length ? 'made-hint' : ''
  );
  render();
}

// Stakes may change between rounds, never while the player is choosing cards.
function adjustBet(action) {
  if (state.phase === 'holding' || state.busy) return;
  if (action === 'down') state.bet = Math.max(10, state.bet - 10);
  if (action === 'up') state.bet += 10;
  if (action === 'half') state.bet = Math.max(10, Math.floor(state.bet / 20) * 10);
  if (action === 'double') state.bet *= 2;
  state.bet = Math.min(state.bet, 1000000);
  state.lastWin = 0;
  playTone('click');
  render();
  save();
}

function changeMusicTrack(direction) {
  const currentIndex = Math.max(0, MUSIC_TRACKS.findIndex(track => track.id === state.musicTrack));
  const nextIndex = (currentIndex + direction + MUSIC_TRACKS.length) % MUSIC_TRACKS.length;
  state.musicTrack = MUSIC_TRACKS[nextIndex].id;
  setMusicTrack(state.musicTrack);
  playTone('click');
  save();
  render();
}

function setVisualPreference(key, value, options) {
  if (!options.some(option => option.id === value)) return;
  state[key] = value;
  playTone('click');
  save();
  render();
}

let toastTimer;
function showToast(text) {
  clearTimeout(toastTimer);
  els.toast.textContent = text;
  els.toast.classList.add('show');
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2800);
}

// Event wiring is kept at the bottom so the round logic above can be read and
// tested independently from the exact buttons and keyboard shortcuts.
els.mainButton.addEventListener('click', () => state.phase === 'holding' ? finishHand() : startHand());
els.cards.addEventListener('click', event => {
  const card = event.target.closest('.card-slot');
  if (card) toggleHold(Number(card.dataset.index));
});
els.betDown.addEventListener('click', () => adjustBet('down'));
els.betUp.addEventListener('click', () => adjustBet('up'));
els.betHalf.addEventListener('click', () => adjustBet('half'));
els.betDouble.addEventListener('click', () => adjustBet('double'));
els.utilityToggle.addEventListener('click', () => {
  const open = els.utilityDock.classList.toggle('open');
  els.utilityToggle.setAttribute('aria-expanded', String(open));
  els.utilityToggle.setAttribute('aria-label', open ? 'Скрыть дополнительные кнопки' : 'Открыть дополнительные кнопки');
});
document.addEventListener('click', event => {
  if (!els.utilityDock.classList.contains('open') || els.utilityDock.contains(event.target)) return;
  els.utilityDock.classList.remove('open');
  els.utilityToggle.setAttribute('aria-expanded', 'false');
});
els.helpButton.addEventListener('click', () => els.helpDialog.showModal());
els.closeHelp.addEventListener('click', () => els.helpDialog.close());
els.helpDialog.addEventListener('click', event => {
  if (event.target === els.helpDialog) els.helpDialog.close();
});
els.historyButton.addEventListener('click', () => {
  renderHistory();
  els.historyDialog.showModal();
});
els.closeHistory.addEventListener('click', () => els.historyDialog.close());
els.historyDialog.addEventListener('click', event => {
  if (event.target === els.historyDialog) els.historyDialog.close();
});
els.settingsButton.addEventListener('click', () => {
  els.settingsDialog.showModal();
  playTone('click');
});
els.closeSettings.addEventListener('click', () => els.settingsDialog.close());
els.settingsDialog.addEventListener('click', event => {
  if (event.target === els.settingsDialog) els.settingsDialog.close();
});
els.previousTrack.addEventListener('click', () => changeMusicTrack(-1));
els.nextTrack.addEventListener('click', () => changeMusicTrack(1));
els.cardThemeChoices.forEach(button => {
  button.addEventListener('click', () => setVisualPreference('cardTheme', button.dataset.cardThemeChoice, CARD_THEMES));
});
els.cardBackChoices.forEach(button => {
  button.addEventListener('click', () => setVisualPreference('cardBack', button.dataset.cardBackChoice, CARD_BACKS));
});
els.tableThemeChoices.forEach(button => {
  button.addEventListener('click', () => setVisualPreference('tableTheme', button.dataset.tableThemeChoice, TABLE_THEMES));
});
els.soundButton.addEventListener('click', () => {
  state.sound = !state.sound;
  if (state.sound) playTone('click');
  save();
  render();
});
els.musicButton.addEventListener('click', () => {
  state.music = !state.music;
  if (state.music) startMusic();
  else stopMusic();
  save();
  render();
});
els.resetButton.addEventListener('click', () => {
  if (!confirm('Вернуть баланс 1000 кредитов и начать заново?')) return;
  state.balance = 1000;
  state.bet = 10;
  state.phase = 'ready';
  state.hand = [];
  state.selected.fill(false);
  state.handHint = null;
  state.winningIndices = [];
  state.lastWin = 0;
  state.resultKey = null;
  state.history = [];
  setMessage('Выберите ставку и раздавайте');
  renderCards();
  render();
  save();
  showToast('Прогресс сброшен');
});
els.depositButton.addEventListener('click', () => {
  state.balance += 1000;
  playTone('win');
  save();
  render();
  showToast('+1000 кредитов на баланс');
});

window.addEventListener('keydown', event => {
  if (els.helpDialog.open) return;
  if (/^[1-7]$/.test(event.key)) toggleHold(Number(event.key) - 1);
  if ((event.key === 'Enter' || event.key === ' ') && event.target === document.body) {
    event.preventDefault();
    els.mainButton.click();
  }
});

// Initial paint uses the sanitized values returned by storage.js.
buildPaytable();
renderCards();
render();
