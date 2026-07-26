/**
 * Returns the amount that can actually be staked for the next hand.
 * When the selected bet exceeds the balance, the entire balance is used.
 */
export function affordableBet(balance, selectedBet) {
  const available = Number.isFinite(balance) ? Math.max(0, Math.floor(balance)) : 0;
  const requested = Number.isFinite(selectedBet) ? Math.max(0, Math.floor(selectedBet)) : 0;
  return Math.min(available, requested);
}
