import { DEXName } from '../types/index.js';

export interface PoolInfo {
  dex: DEXName;
  poolId: string;
  coinTypeA: string;
  coinTypeB: string;
  reserveA: bigint;
  reserveB: bigint;
  feeRate?: number; // e.g., 0.003 for 0.3%
  lastUpdated: number;
}

export interface DEXAdapter {
  name: DEXName;
  
  // Fetch all active pools from the DEX
  fetchPools(): Promise<PoolInfo[]>;
  
  // Get current reserves for a specific pool
  getPoolReserves(poolId: string): Promise<{
    reserveA: bigint;
    reserveB: bigint;
  }>;
  
  // Calculate output amount given input (includes fees)
  calculateAmountOut(
    amountIn: bigint,
    reserveIn: bigint,
    reserveOut: bigint
  ): bigint;
}

export interface TokenGraphNode {
  coinType: string;
  neighbors: Map<string, PoolInfo[]>; // coinType -> pools that connect to it
}

export interface TokenGraph {
  nodes: Map<string, TokenGraphNode>;
  pools: Map<string, PoolInfo>;
}
