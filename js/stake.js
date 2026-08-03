/**
 * Returns the amount that can actually be staked for the next hand.
 * When the selected bet exceeds the balance, the entire balance is used.
 */
export function affordableBet(balance, selectedBet) {
  const available = Number.isFinite(balance) ? Math.max(0, Math.round(balance * 100) / 100) : 0;
  const requested = Number.isFinite(selectedBet) ? Math.max(0, Math.round(selectedBet * 100) / 100) : 0;
  return Math.min(available, requested);
}

/** Keep fractional payouts stable without accumulating float noise. */
export function calculateWin(bet, multiplier) {
  if (!Number.isFinite(bet) || !Number.isFinite(multiplier)) return 0;
  return Math.max(0, Math.round(bet * multiplier * 100) / 100);
}
