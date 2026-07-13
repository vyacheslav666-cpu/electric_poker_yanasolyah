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
import { calculateHandOdds, ODDS_LABELS } from './probability.js';
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
  fxLayer: document.querySelector('#fxLayer'),
  toast: document.querySelector('#toast'),
  oddsWidget: document.querySelector('#oddsWidget'),
  oddsWinChance: document.querySelector('#oddsWinChance'),
  oddsSummaryMeta: document.querySelector('#oddsSummaryMeta'),
  oddsPanelMeta: document.querySelector('#oddsPanelMeta'),
  oddsRows: document.querySelector('#oddsRows')
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
  busy: false,
  odds: { status: 'idle', result: null, error: '' }
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


let oddsWorker = null;
let oddsFallbackTimer = null;
let oddsRequestId = 0;

function stopOddsCalculation() {
  if (oddsWorker) oddsWorker.terminate();
  oddsWorker = null;
  clearTimeout(oddsFallbackTimer);
  oddsFallbackTimer = null;
}

function formatOddsPercent(probability, exact = true) {
  const percent = probability * 100;
  if (percent === 0) return exact ? '0%' : '<0,01%';
  if (percent < .01) return '<0,01%';
  const digits = percent < 1 ? 2 : 1;
  return percent.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  }) + '%';
}

function oddsMeta(result) {
  if (result.drawCount === 0) return 'Точно · текущая рука';
  const total = result.totalOutcomes.toLocaleString('ru-RU');
  if (result.exact) return 'Точно · ' + total + ' вариантов замены';
  return 'Оценка · ' + result.evaluatedOutcomes.toLocaleString('ru-RU') +
    ' сценариев из ' + total;
}

function renderOdds() {
  const { status, result, error } = state.odds;
  els.oddsWidget.dataset.status = status;
  els.oddsRows.setAttribute('aria-busy', String(status === 'loading'));

  if (status === 'idle') {
    els.oddsWinChance.textContent = '—';
    els.oddsSummaryMeta.textContent = 'после раздачи';
    els.oddsPanelMeta.textContent = 'Раздайте карты';
    els.oddsRows.innerHTML = '<p class="odds-placeholder">После раздачи здесь появится шанс каждой комбинации.</p>';
    return;
  }

  if (status === 'loading') {
    els.oddsWinChance.textContent = '…';
    els.oddsSummaryMeta.textContent = 'считаем варианты';
    els.oddsPanelMeta.textContent = 'Расчёт в фоне';
    els.oddsRows.innerHTML = '<div class="odds-loading"><i></i><span>Перебираем возможные карты…</span></div>';
    return;
  }

  if (status === 'error' || !result) {
    els.oddsWinChance.textContent = '—';
    els.oddsSummaryMeta.textContent = 'расчёт недоступен';
    els.oddsPanelMeta.textContent = 'Ошибка';
    els.oddsRows.innerHTML = '<p class="odds-placeholder">' + (error || 'Не удалось рассчитать вероятности.') + '</p>';
    return;
  }

  const prefix = result.exact ? '' : '≈';
  els.oddsWinChance.textContent = prefix + formatOddsPercent(result.winProbability, result.exact);
  els.oddsSummaryMeta.textContent = result.drawCount
    ? 'если заменить: ' + result.drawCount
    : state.phase === 'result' ? 'итог раздачи' : 'оставить все карты';
  els.oddsPanelMeta.textContent = oddsMeta(result);
  els.oddsRows.innerHTML = ODDS_LABELS.map(item => {
    const probability = result.probabilities[item.key];
    const percent = Math.max(0, Math.min(100, probability * 100));
    return '<div class="odds-row" data-odds-key="' + item.key + '">' +
      '<span>' + item.name + '</span>' +
      '<i class="odds-meter"><b style="--odds-width:' + percent + '%"></b></i>' +
      '<strong>' + formatOddsPercent(probability, result.exact) + '</strong>' +
    '</div>';
  }).join('');
}

function resultOdds() {
  const key = state.resultKey || 'none';
  const counts = Object.fromEntries(ODDS_LABELS.map(item => [item.key, item.key === key ? 1 : 0]));
  const probabilities = { ...counts };
  return {
    exact: true,
    drawCount: 0,
    totalOutcomes: 1,
    evaluatedOutcomes: 1,
    counts,
    probabilities,
    winProbability: key === 'none' ? 0 : 1
  };
}

function requestOdds() {
  stopOddsCalculation();
  const requestId = ++oddsRequestId;

  if (state.hand.length !== 7) {
    state.odds = { status: 'idle', result: null, error: '' };
    renderOdds();
    return;
  }

  if (state.phase === 'result') {
    state.odds = { status: 'done', result: resultOdds(), error: '' };
    renderOdds();
    return;
  }

  state.odds = { status: 'loading', result: null, error: '' };
  renderOdds();
  const payload = {
    requestId,
    hand: state.hand,
    selected: [...state.selected],
    sampleSize: 200000
  };

  const acceptResult = message => {
    if (message.requestId !== oddsRequestId) return;
    stopOddsCalculation();
    state.odds = message.error
      ? { status: 'error', result: null, error: message.error }
      : { status: 'done', result: message.result, error: '' };
    renderOdds();
  };

  if ('Worker' in window) {
    oddsWorker = new Worker(new URL('./probability-worker.js', import.meta.url), { type: 'module' });
    oddsWorker.addEventListener('message', event => acceptResult(event.data));
    oddsWorker.addEventListener('error', () => acceptResult({
      requestId,
      error: 'Фоновый расчёт не запустился.'
    }), { once: true });
    oddsWorker.postMessage(payload);
    return;
  }

  oddsFallbackTimer = setTimeout(() => {
    try {
      acceptResult({ requestId, result: calculateHandOdds(payload) });
    } catch (error) {
      acceptResult({
        requestId,
        error: error instanceof Error ? error.message : 'Не удалось рассчитать вероятности.'
      });
    }
  }, 0);
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
      const animationOrder = animatedIndices ? animatedIndices.indexOf(index) : index;
      button.style.setProperty('--card-delay', String(animationOrder * 85) + 'ms');
    }
    if (state.phase === 'result' && state.winningIndices.includes(index)) {
      button.classList.add('winner');
      button.style.setProperty('--win-delay', `${state.winningIndices.indexOf(index) * 90}ms`);
    }
    button.dataset.index = index;
    button.setAttribute('aria-label', card ? `${card.label} ${card.symbol}${state.selected[index] ? ', заменить' : ''}` : 'Закрытая карта');
    button.setAttribute('aria-pressed', state.selected[index] ? 'true' : 'false');

    if (!card) {
      button.innerHTML = '<span class="card-inner"><span class="card-back" aria-hidden="true"></span></span>';
    } else {
      button.innerHTML = '<span class="card-inner has-card">' +
        '<span class="card-back" aria-hidden="true"></span>' +
        '<span class="card-face ' + card.color + '">' +
          '<span class="card-rank">' + card.label + '<small>' + card.symbol + '</small></span>' +
          '<span class="card-suit" aria-hidden="true">' + card.symbol + '</span>' +
        '</span>' +
      '</span>';
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
  els.message.className = 'message' + (kind ? ' ' + kind : '');
  const payout = PAYOUTS.find(item => item.key === state.resultKey);
  const multiplier = payout?.multiplier || 0;
  const isWin = kind === 'win';
  const winTier = multiplier >= 25 ? 'jackpot' : multiplier >= 4 ? 'big' : 'win';
  els.cabinet.classList.toggle('celebration', isWin);
  els.cabinet.classList.toggle('jackpot', isWin && multiplier >= 25);
  els.cabinet.dataset.winTier = isWin ? winTier : '';
  PAYOUTS.forEach(item => {
    els.cabinet.classList.toggle('result-' + item.key, isWin && state.resultKey === item.key);
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

function waitForCardAnimations(selector, fallbackMs) {
  const animatedCards = [...els.cards.querySelectorAll(selector)];
  if (!animatedCards.length) return Promise.resolve();
  const lastCard = animatedCards[animatedCards.length - 1];
  return new Promise(resolve => {
    let finished = false;
    const complete = () => {
      if (finished) return;
      finished = true;
      clearTimeout(fallbackTimer);
      resolve();
    };
    const fallbackTimer = setTimeout(complete, fallbackMs);
    lastCard.addEventListener('animationend', complete, { once: true });
    lastCard.addEventListener('animationcancel', complete, { once: true });
  });
}

let celebrationTimer;
function clearCelebration() {
  clearTimeout(celebrationTimer);
  delete document.body.dataset.celebration;
  els.fxLayer.replaceChildren();
}

function launchCelebration(multiplier) {
  clearCelebration();
  const tier = multiplier >= 25 ? 'jackpot' : multiplier >= 4 ? 'big' : 'win';
  const particleCount = tier === 'jackpot' ? 72 : tier === 'big' ? 44 : 24;
  const palette = ['#fff2a1', '#ff4f9b', '#5ff7ff', '#8d6bff', '#61ffb0'];
  const fragment = document.createDocumentFragment();
  document.body.dataset.celebration = tier;
  els.win.classList.remove('score-pop');
  void els.win.offsetWidth;
  els.win.classList.add('score-pop');

  for (let index = 0; index < particleCount; index++) {
    const particle = document.createElement('i');
    particle.className = 'fx-particle';
    particle.style.setProperty('--particle-x', String(Math.random() * 100) + 'vw');
    particle.style.setProperty('--particle-drift', String((Math.random() - .5) * 26) + 'vw');
    particle.style.setProperty('--particle-delay', String(Math.random() * 420) + 'ms');
    particle.style.setProperty('--particle-duration', String(1450 + Math.random() * 1100) + 'ms');
    particle.style.setProperty('--particle-spin', String(360 + Math.random() * 720) + 'deg');
    particle.style.setProperty('--particle-color', palette[index % palette.length]);
    fragment.append(particle);
  }

  els.fxLayer.append(fragment);
  celebrationTimer = setTimeout(clearCelebration, tier === 'jackpot' ? 3200 : 2600);
}

// Round state: ready → holding → result.
async function startHand() {
  const bet = state.bet;
  if (state.balance < bet) {
    showToast('Не хватает кредитов. Сбросьте прогресс или уменьшите ставку.');
    playTone('error');
    return;
  }
  state.busy = true;
  clearCelebration();
  state.phase = 'holding';
  state.balance -= bet;
  state.lastWin = 0;
  state.resultKey = null;
  state.selected.fill(false);
  state.winningIndices = [];
  state.deck = shuffle(makeDeck());
  state.hand = Array.from({ length: 7 }, draw);
  state.handHint = analyzeHandHints(state.hand);
  requestOdds();
  setMessage(state.handHint.label, state.handHint.madeIndices.length ? 'made-hint' : '');
  renderCards(true);
  render();
  playTone('deal');
  save();
  await waitForCardAnimations('.card-slot.dealing', 1700);
  state.busy = false;
  renderCards(false);
  render();
}

// Only selected cards leave the hand. The poker engine then checks every
// possible five-card subset and returns the strongest paying combination.
async function finishHand() {
  state.busy = true;
  state.handHint = null;
  stopOddsCalculation();
  state.odds = { status: 'loading', result: null, error: '' };
  renderOdds();
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
  await waitForCardAnimations('.card-slot.redrawing', 1450);

  const result = evaluateSeven(state.hand);
  state.phase = 'result';
  state.resultKey = result?.payout.key || null;
  state.winningIndices = result?.indices || [];
  if (result) {
    state.lastWin = result.payout.multiplier * state.bet;
    state.balance += state.lastWin;
    setWinMessage(result.payout.name, state.lastWin);
    if (navigator.vibrate) navigator.vibrate([55, 35, 70, 35, 110]);
    launchCelebration(result.payout.multiplier);
    playTone(result.payout.multiplier >= 25 ? 'jackpot' : result.payout.multiplier >= 4 ? 'bigWin' : 'win');
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
  requestOdds();
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
  requestOdds();
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
document.addEventListener('click', event => {
  if (els.oddsWidget.open && !els.oddsWidget.contains(event.target)) {
    els.oddsWidget.open = false;
  }
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
  requestOdds();
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
  if (event.key === 'Escape' && els.oddsWidget.open) els.oddsWidget.open = false;
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
requestOdds();
