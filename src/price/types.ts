import { DEXName } from '../types/index.js';

export interface TokenPrice {
  /** Token type (coin type string) */
  tokenType: string;
  /** Quote token (what this token is priced in) */
  quoteToken: string;
  /** Price (how much quoteToken per 1 token) */
  price: number;
  /** Pool ID where this price comes from */
  poolId: string;
  /** DEX name */
  dex: DEXName;
  /** Reserves (for verification) */
  reserveBase: bigint;
  reserveQuote: bigint;
  /** Timestamp */
  timestamp: number;
}

export interface PriceComparison {
  /** Base token */
  baseToken: string;
  /** Quote token */
  quoteToken: string;
  /** Prices from different DEXes */
  prices: TokenPrice[];
  /** Best buy price (lowest) */
  bestBuy: TokenPrice;
  /** Best sell price (highest) */
  bestSell: TokenPrice;
  /** Price spread percentage */
  spreadPercent: number;
  /** Timestamp */
  timestamp: number;
}

export interface TokenMetadata {
  coinType: string;
  symbol?: string;
  name?: string;
  decimals?: number;
}
