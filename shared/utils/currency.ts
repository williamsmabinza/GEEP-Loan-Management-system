// ==============================================================================
// Nexa LMS - Tanzanian Shilling (TZS) Currency Utility
// ==============================================================================

export const CURRENCY_CODE = 'TZS';
export const CURRENCY_SYMBOL = 'TZS';

/**
 * Formats monetary amounts in Tanzanian Shillings (TZS)
 * e.g., formatTZS(1250000) -> "TZS 1,250,000.00" or "TZS 1,250,000"
 */
export function formatTZS(
  amount: number | string | null | undefined,
  options?: { hideDecimals?: boolean; compact?: boolean }
): string {
  if (amount === null || amount === undefined || amount === '') return 'TZS 0';
  const val = Number(amount);
  if (isNaN(val)) return 'TZS 0';

  if (options?.compact) {
    if (Math.abs(val) >= 1_000_000_000) {
      return `TZS ${(val / 1_000_000_000).toFixed(1)}B`;
    }
    if (Math.abs(val) >= 1_000_000) {
      return `TZS ${(val / 1_000_000).toFixed(1)}M`;
    }
    if (Math.abs(val) >= 1_000) {
      return `TZS ${(val / 1_000).toFixed(0)}K`;
    }
  }

  const fractionDigits = options?.hideDecimals ? 0 : 2;
  const formatted = val.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });

  return `TZS ${formatted}`;
}

export function parseTZS(input: string): number {
  if (!input) return 0;
  const clean = input.replace(/[^0-9.-]+/g, '');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}
