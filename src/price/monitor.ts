import { SuiClient } from '@mysten/sui/client';
import { PoolRegistry } from '../dex/pool-registry.js';
import { PoolInfo } from '../dex/types.js';
import { TokenPrice, PriceComparison } from './types.js';
import { calculatePrice, calculateSpread } from './calculator.js';
import logger from '../utils/logger.js';

export class PriceMonitor {
  private registry: PoolRegistry;
  private priceCache: Map<string, TokenPrice[]> = new Map();
  
  constructor(_client: SuiClient, registry: PoolRegistry) {
    this.registry = registry;
  }
  
  /**
   * Get all prices for a token pair across all DEXes
   * @param refresh If true, refresh reserves before calculating prices
   */
  async getPrices(
    baseToken: string,
    quoteToken: string,
    refresh: boolean = false
  ): Promise<TokenPrice[]> {
    const cacheKey = `${baseToken}:${quoteToken}`;
    
    // Check cache first (only if not refreshing)
    if (!refresh) {
      const cached = this.priceCache.get(cacheKey);
      if (cached && cached.length > 0) {
        const age = Date.now() - cached[0].timestamp;
        if (age < 5000) { // 5 second cache
          return cached;
        }
      }
    }
    
    // Find all pools that contain this pair
    const pools = this.registry.findPoolsForPair(baseToken, quoteToken);
    
    // Refresh reserves if needed
    if (refresh) {
      await Promise.all(
        pools.map(pool => this.updatePoolReserves(pool.poolId))
      );
    }
    
    const prices: TokenPrice[] = [];
    for (const pool of pools) {
      // Skip pools with zero reserves
      if (pool.reserveA === 0n || pool.reserveB === 0n) {
        logger.debug({ poolId: pool.poolId }, 'Skipping pool with zero reserves');
        continue;
      }
      
      const price = calculatePrice(baseToken, quoteToken, pool);
      if (price) {
        prices.push(price);
      }
    }
    
    // Update cache
    this.priceCache.set(cacheKey, prices);
    
    return prices;
  }
  
  /**
   * Compare prices across DEXes
   */
  async comparePrices(
    baseToken: string,
    quoteToken: string,
    refresh: boolean = false
  ): Promise<PriceComparison | null> {
    const prices = await this.getPrices(baseToken, quoteToken, refresh);
    
    if (prices.length === 0) {
      return null;
    }
    
    // Sort by price
    const sorted = [...prices].sort((a, b) => a.price - b.price);
    
    const bestBuy = sorted[0]; // Lowest price (best for buying)
    const bestSell = sorted[sorted.length - 1]; // Highest price (best for selling)
    
    const spreadPercent = calculateSpread(bestBuy.price, bestSell.price);
    
    return {
      baseToken,
      quoteToken,
      prices: sorted,
      bestBuy,
      bestSell,
      spreadPercent,
      timestamp: Date.now(),
    };
  }
  
  /**
   * Get all available trading pairs
   */
  getAllPairs(): Array<{ baseToken: string; quoteToken: string }> {
    const pairs = new Set<string>();
    const allPools = this.registry.getAllPools();
    
    for (const pool of allPools) {
      // Add both directions
      pairs.add(`${pool.coinTypeA}:${pool.coinTypeB}`);
      pairs.add(`${pool.coinTypeB}:${pool.coinTypeA}`);
    }
    
    return Array.from(pairs).map(pair => {
      const [baseToken, quoteToken] = pair.split(':');
      return { baseToken, quoteToken };
    });
  }
  
  /**
   * Find arbitrage opportunities (price spread > threshold)
   */
  async findArbitrageOpportunities(
    minSpreadPercent: number = 0.5,
    refresh: boolean = false
  ): Promise<PriceComparison[]> {
    const opportunities: PriceComparison[] = [];
    const allPools = this.registry.getAllPools();
    
    // Group pools by token pair
    const pairMap = new Map<string, PoolInfo[]>();
    
    for (const pool of allPools) {
      const key1 = `${pool.coinTypeA}:${pool.coinTypeB}`;
      
      if (!pairMap.has(key1)) {
        pairMap.set(key1, []);
      }
      pairMap.get(key1)!.push(pool);
    }
    
    // Check each pair
    for (const [pairKey, pools] of pairMap.entries()) {
      if (pools.length < 2) {
        continue; // Need at least 2 pools for arbitrage
      }
      
      const [baseToken, quoteToken] = pairKey.split(':');
      const comparison = await this.comparePrices(baseToken, quoteToken, refresh);
      
      if (comparison && comparison.spreadPercent >= minSpreadPercent) {
        opportunities.push(comparison);
      }
    }
    
    // Sort by spread (highest first)
    return opportunities.sort((a, b) => b.spreadPercent - a.spreadPercent);
  }
  
  /**
   * Update reserves for a specific pool
   */
  async updatePoolReserves(poolId: string): Promise<void> {
    const pool = this.registry.getPool(poolId);
    if (!pool) {
      logger.warn({ poolId }, 'Pool not found');
      return;
    }
    
    try {
      const adapter = this.registry.getAdapter(pool.dex);
      if (!adapter) {
        logger.warn({ dex: pool.dex }, 'Adapter not found');
        return;
      }
      
      const reserves = await adapter.getPoolReserves(poolId);
      pool.reserveA = reserves.reserveA;
      pool.reserveB = reserves.reserveB;
      pool.lastUpdated = Date.now();
      
      // Invalidate cache for this pool's pairs
      this.invalidateCacheForPool(pool);
      
    } catch (error) {
      logger.error({ error, poolId }, 'Failed to update pool reserves');
    }
  }
  
  /**
   * Invalidate cache entries for a pool
   */
  private invalidateCacheForPool(pool: PoolInfo): void {
    const key1 = `${pool.coinTypeA}:${pool.coinTypeB}`;
    const key2 = `${pool.coinTypeB}:${pool.coinTypeA}`;
    this.priceCache.delete(key1);
    this.priceCache.delete(key2);
  }
  
  /**
   * Clear all cached prices
   */
  clearCache(): void {
    this.priceCache.clear();
  }
}
