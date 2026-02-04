// Network types
export type SuiNetwork = 'mainnet' | 'testnet' | 'devnet';

// DEX types
export type DEXName = 'cetus' | 'turbos';

// Pool data structure
export interface Pool {
  dex: DEXName;
  poolId: string;
  coinTypeX: string;
  coinTypeY: string;
  reserveX: bigint;
  reserveY: bigint;
  lastUpdated: number;
}

// Arbitrage opportunity types
export type ArbitrageType = 'cross-dex' | 'cyclic';

export interface ArbitrageOpportunity {
  type: ArbitrageType;
  profitPercent: number;
  estimatedProfit: number;
  estimatedGas: number;
  netProfit: number;
}

export interface CrossDEXOpportunity extends ArbitrageOpportunity {
  type: 'cross-dex';
  buyDex: DEXName;
  sellDex: DEXName;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  buyPrice: number;
  sellPrice: number;
}

export interface CyclicOpportunity extends ArbitrageOpportunity {
  type: 'cyclic';
  path: string[]; // e.g., ['SUI', 'USDC', 'WETH', 'SUI']
  dexes: DEXName[]; // DEX for each hop
  amounts: bigint[]; // Amount at each step
}

// Capital management
export interface Balance {
  coinType: string;
  amount: bigint;
  usdValue: number;
}

// Configuration
export interface BotConfig {
  network: SuiNetwork;
  rpcUrl: string;
  rpcFallbacks: string[];
  
  // Capital management
  initialCapitalUSD: number;
  perTradeLimitPercent: number; // 0.1 = 10%
  
  // Arbitrage settings
  minProfitPercent: number; // 0.01 = 1%
  maxSlippagePercent: number; // 0.005 = 0.5%
  maxHops: number; // 4
  
  // Monitoring
  pollIntervalMs: number; // 1000 = 1s
  
  // Risk management
  maxDailyLossUSD: number;
  circuitBreakerFailures: number; // 5
  
  // DEX configuration
  enabledDexes: DEXName[];
}

// Database types
export interface TradeRecord {
  id?: number;
  timestamp: number;
  digest: string;
  type: ArbitrageType;
  dex: DEXName | string; // Can be "cetus+turbos" for cross-dex
  coinIn: string;
  coinOut: string;
  amountIn: string;
  amountOut: string;
  gasUsed: string;
  profit: string;
  status: 'success' | 'failed' | 'pending';
}
