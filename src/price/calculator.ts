import { PoolInfo } from '../dex/types.js';
import { TokenPrice } from './types.js';

/**
 * Calculate price from pool reserves
 * Price = how much quoteToken per 1 baseToken
 */
export function calculatePrice(
  baseToken: string,
  quoteToken: string,
  pool: PoolInfo
): TokenPrice | null {
  // Determine which reserve is base and which is quote
  let reserveBase: bigint;
  let reserveQuote: bigint;
  
  if (pool.coinTypeA === baseToken && pool.coinTypeB === quoteToken) {
    reserveBase = pool.reserveA;
    reserveQuote = pool.reserveB;
  } else if (pool.coinTypeB === baseToken && pool.coinTypeA === quoteToken) {
    reserveBase = pool.reserveB;
    reserveQuote = pool.reserveA;
  } else {
    // Pool doesn't contain the requested pair
    return null;
  }
  
  // Avoid division by zero
  if (reserveBase === 0n) {
    return null;
  }
  
  // Calculate price: quoteToken / baseToken
  // Convert to float for display (loses precision but ok for prices)
  const price = Number(reserveQuote) / Number(reserveBase);
  
  return {
    tokenType: baseToken,
    quoteToken,
    price,
    poolId: pool.poolId,
    dex: pool.dex,
    reserveBase,
    reserveQuote,
    timestamp: Date.now(),
  };
}

/**
 * Format price for display
 */
export function formatPrice(price: number, decimals: number = 6): string {
  if (price === 0) return '0';
  
  // For very small numbers, use scientific notation
  if (price < 0.000001) {
    return price.toExponential(decimals);
  }
  
  // For normal numbers, use fixed decimal
  if (price < 1) {
    return price.toFixed(decimals);
  }
  
  // For larger numbers, limit decimals
  if (price < 1000) {
    return price.toFixed(4);
  }
  
  // For very large numbers, use compact notation
  return price.toLocaleString('en-US', {
    maximumFractionDigits: 2,
    notation: 'compact',
  });
}

/**
 * Calculate percentage difference between two prices
 */
export function calculateSpread(price1: number, price2: number): number {
  if (price1 === 0 || price2 === 0) return 0;
  
  const lower = Math.min(price1, price2);
  const higher = Math.max(price1, price2);
  
  return ((higher - lower) / lower) * 100;
}

/**
 * Format spread percentage
 */
export function formatSpread(spreadPercent: number): string {
  if (spreadPercent < 0.01) {
    return '<0.01%';
  }
  return `${spreadPercent.toFixed(2)}%`;
}

/**
 * Shorten coin type for display
 * Example: 0x2::sui::SUI -> SUI
 */
export function shortenCoinType(coinType: string): string {
  // Try to extract the last part after ::
  const parts = coinType.split('::');
  if (parts.length >= 3) {
    return parts[parts.length - 1].toUpperCase();
  }
  
  // If it's a long hex address, truncate it
  if (coinType.startsWith('0x') && coinType.length > 20) {
    return `${coinType.substring(0, 8)}...${coinType.substring(coinType.length - 6)}`;
  }
  
  return coinType;
}
