/**
 * Returns the amount that can actually be staked for the next hand.
 * When the selected bet exceeds the balance, the entire balance is used.
 */
export function affordableBet(balance, selectedBet) {
  const available = Number.isFinite(balance) ? Math.max(0, Math.round(balance * 100) / 100) : 0;
  const requested = Number.isFinite(selectedBet) ? Math.max(0, Math.round(selectedBet * 100) / 100) : 0;
  return Math.min(available, requested);
}

/** Each replaced card removes ten percentage points from the final payout. */
export function rerollPayoutFactor(replacedCards) {
  const count = Number.isFinite(replacedCards)
    ? Math.max(0, Math.min(7, Math.floor(replacedCards)))
    : 0;
  return Math.round((1 - count * 0.1) * 100) / 100;
}

/** Keep fractional payouts stable without accumulating float noise. */
export function calculateWin(bet, multiplier, payoutFactor = 1) {
  if (!Number.isFinite(bet) || !Number.isFinite(multiplier) || !Number.isFinite(payoutFactor)) return 0;
  return Math.max(0, Math.round(bet * multiplier * payoutFactor * 100) / 100);
}
