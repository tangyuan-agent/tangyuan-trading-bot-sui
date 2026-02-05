import { SuiClient } from '@mysten/sui/client';
import { DEXAdapter, PoolInfo, TokenGraph } from './types.js';
import { CetusAdapter } from './adapters/cetus.js';
import { TurbosAdapter } from './adapters/turbos.js';
import logger from '../utils/logger.js';
import { DEXName } from '../types/index.js';

export class PoolRegistry {
  private pools: Map<string, PoolInfo> = new Map();
  private adapters: Map<DEXName, DEXAdapter> = new Map();
  private tokenGraph: TokenGraph = {
    nodes: new Map(),
    pools: new Map(),
  };
  
  constructor(client: SuiClient) {
    // Initialize DEX adapters
    this.adapters.set('cetus', new CetusAdapter(client));
    this.adapters.set('turbos', new TurbosAdapter(client));
  }
  
  async initialize(enabledDexes: DEXName[] = ['cetus', 'turbos']): Promise<void> {
    logger.info({ enabledDexes }, 'Initializing pool registry...');
    
    const allPools: PoolInfo[] = [];
    
    // Fetch pools from all enabled DEXes
    for (const dexName of enabledDexes) {
      const adapter = this.adapters.get(dexName);
      if (!adapter) {
        logger.warn({ dexName }, 'DEX adapter not found');
        continue;
      }
      
      try {
        const pools = await adapter.fetchPools();
        allPools.push(...pools);
        logger.info({ dex: dexName, poolCount: pools.length }, 'Pools fetched');
      } catch (error) {
        logger.error({ error, dex: dexName }, 'Failed to fetch pools from DEX');
      }
    }
    
    // Store all pools
    for (const pool of allPools) {
      this.pools.set(pool.poolId, pool);
    }
    
    // Build token graph
    this.buildTokenGraph();
    
    logger.info(
      {
        totalPools: this.pools.size,
        totalTokens: this.tokenGraph.nodes.size,
      },
      'Pool registry initialized'
    );
  }
  
  private buildTokenGraph(): void {
    this.tokenGraph.nodes.clear();
    this.tokenGraph.pools.clear();
    
    for (const pool of this.pools.values()) {
      // Add pool to graph
      this.tokenGraph.pools.set(pool.poolId, pool);
      
      // Ensure both tokens exist as nodes
      if (!this.tokenGraph.nodes.has(pool.coinTypeA)) {
        this.tokenGraph.nodes.set(pool.coinTypeA, {
          coinType: pool.coinTypeA,
          neighbors: new Map(),
        });
      }
      
      if (!this.tokenGraph.nodes.has(pool.coinTypeB)) {
        this.tokenGraph.nodes.set(pool.coinTypeB, {
          coinType: pool.coinTypeB,
          neighbors: new Map(),
        });
      }
      
      // Add edges (bidirectional)
      const nodeA = this.tokenGraph.nodes.get(pool.coinTypeA)!;
      const nodeB = this.tokenGraph.nodes.get(pool.coinTypeB)!;
      
      // A -> B
      if (!nodeA.neighbors.has(pool.coinTypeB)) {
        nodeA.neighbors.set(pool.coinTypeB, []);
      }
      nodeA.neighbors.get(pool.coinTypeB)!.push(pool);
      
      // B -> A
      if (!nodeB.neighbors.has(pool.coinTypeA)) {
        nodeB.neighbors.set(pool.coinTypeA, []);
      }
      nodeB.neighbors.get(pool.coinTypeA)!.push(pool);
    }
  }
  
  async refreshPoolReserves(poolIds?: string[]): Promise<void> {
    const poolsToRefresh = poolIds
      ? poolIds.map(id => this.pools.get(id)).filter(Boolean) as PoolInfo[]
      : Array.from(this.pools.values());
    
    logger.debug({ count: poolsToRefresh.length }, 'Refreshing pool reserves...');
    
    for (const pool of poolsToRefresh) {
      const adapter = this.adapters.get(pool.dex);
      if (!adapter) continue;
      
      try {
        const { reserveA, reserveB } = await adapter.getPoolReserves(pool.poolId);
        pool.reserveA = reserveA;
        pool.reserveB = reserveB;
        pool.lastUpdated = Date.now();
      } catch (error) {
        logger.warn({ error, poolId: pool.poolId }, 'Failed to refresh pool reserves');
      }
    }
  }
  
  getPool(poolId: string): PoolInfo | undefined {
    return this.pools.get(poolId);
  }
  
  getAllPools(): PoolInfo[] {
    return Array.from(this.pools.values());
  }
  
  getPoolsByDex(dex: DEXName): PoolInfo[] {
    return Array.from(this.pools.values()).filter(p => p.dex === dex);
  }
  
  getPoolsForPair(coinTypeA: string, coinTypeB: string): PoolInfo[] {
    const nodeA = this.tokenGraph.nodes.get(coinTypeA);
    if (!nodeA) return [];
    
    return nodeA.neighbors.get(coinTypeB) || [];
  }
  
  getPrice(coinIn: string, coinOut: string, dex?: DEXName): number | null {
    const pools = this.getPoolsForPair(coinIn, coinOut);
    
    if (pools.length === 0) return null;
    
    // If DEX specified, filter by it
    const targetPool = dex
      ? pools.find(p => p.dex === dex)
      : pools[0]; // Take first pool
    
    if (!targetPool || targetPool.reserveA === 0n || targetPool.reserveB === 0n) {
      return null;
    }
    
    // Determine which reserve is which
    const isAtoB = targetPool.coinTypeA === coinIn;
    const reserveIn = isAtoB ? targetPool.reserveA : targetPool.reserveB;
    const reserveOut = isAtoB ? targetPool.reserveB : targetPool.reserveA;
    
    // Price = reserveOut / reserveIn
    return Number(reserveOut) / Number(reserveIn);
  }
  
  getTokenGraph(): TokenGraph {
    return this.tokenGraph;
  }
  
  getAllTokens(): string[] {
    return Array.from(this.tokenGraph.nodes.keys());
  }
  
  getNeighbors(coinType: string): Map<string, PoolInfo[]> {
    const node = this.tokenGraph.nodes.get(coinType);
    return node?.neighbors || new Map();
  }
  
  getAdapter(dex: DEXName): DEXAdapter | undefined {
    return this.adapters.get(dex);
  }
  
  findPoolsForPair(coinTypeA: string, coinTypeB: string): PoolInfo[] {
    return this.getPoolsForPair(coinTypeA, coinTypeB);
  }
}
