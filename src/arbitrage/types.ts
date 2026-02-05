import { DEXName } from '../types/index.js';

export interface ArbitragePair {
  /** Base token type */
  baseToken: string;
  /** Quote token type */
  quoteToken: string;
  /** Pools from different DEXes */
  pools: Array<{
    dex: DEXName;
    poolId: string;
    reserveA: bigint;
    reserveB: bigint;
    feeRate: number;
  }>;
  /** Last price check */
  lastCheck?: number;
  /** Current spread percentage */
  spreadPercent?: number;
  /** Price history */
  priceHistory?: Array<{
    timestamp: number;
    cetusPrice?: number;
    turbosPrice?: number;
    spread: number;
  }>;
}

export interface ArbitrageOpportunity {
  pair: ArbitragePair;
  buyDex: DEXName;
  buyPrice: number;
  sellDex: DEXName;
  sellPrice: number;
  spreadPercent: number;
  timestamp: number;
  profitEstimate?: number;
}

export interface MonitorConfig {
  /** Minimum spread to consider (percentage) */
  minSpread: number;
  /** How often to check prices (milliseconds) */
  checkInterval: number;
  /** How many opportunities to keep in history */
  historySize: number;
  /** Auto-refresh reserves */
  autoRefresh: boolean;
}
