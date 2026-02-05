import { PoolRegistry } from '../dex/pool-registry.js';
import { PoolInfo } from '../dex/types.js';
import { ArbitragePair } from './types.js';
import logger from '../utils/logger.js';

/**
 * Find token pairs that exist on multiple DEXes
 */
export class ArbitragePairFinder {
  private registry: PoolRegistry;
  
  constructor(registry: PoolRegistry) {
    this.registry = registry;
  }
  
  /**
   * Find all pairs that exist on both Cetus and Turbos
   */
  findCrossDexPairs(): ArbitragePair[] {
    const allPools = this.registry.getAllPools();
    
    // Group pools by normalized pair key
    const pairMap = new Map<string, PoolInfo[]>();
    
    for (const pool of allPools) {
      // Create normalized key (sort tokens alphabetically)
      const tokens = [pool.coinTypeA, pool.coinTypeB].sort();
      const key = `${tokens[0]}::${tokens[1]}`;
      
      if (!pairMap.has(key)) {
        pairMap.set(key, []);
      }
      pairMap.get(key)!.push(pool);
    }
    
    // Filter pairs that exist on 2+ DEXes
    const crossDexPairs: ArbitragePair[] = [];
    
    for (const [pairKey, pools] of pairMap.entries()) {
      const dexes = new Set(pools.map(p => p.dex));
      
      if (dexes.size >= 2) {
        // Extract tokens from key
        const [baseToken, quoteToken] = pairKey.split('::');
        
        crossDexPairs.push({
          baseToken,
          quoteToken,
          pools: pools.map(p => ({
            dex: p.dex,
            poolId: p.poolId,
            reserveA: p.reserveA,
            reserveB: p.reserveB,
            feeRate: p.feeRate || 0.003,
          })),
        });
      }
    }
    
    logger.info({ count: crossDexPairs.length }, 'Cross-DEX pairs found');
    return crossDexPairs;
  }
  
  /**
   * Find pairs with specific token
   */
  findPairsWithToken(tokenType: string): ArbitragePair[] {
    const allPairs = this.findCrossDexPairs();
    return allPairs.filter(
      pair => pair.baseToken === tokenType || pair.quoteToken === tokenType
    );
  }
  
  /**
   * Get statistics about cross-DEX pairs
   */
  getStatistics() {
    const pairs = this.findCrossDexPairs();
    
    const stats = {
      totalPairs: pairs.length,
      pairsPerDexCount: new Map<number, number>(),
      tokensInvolved: new Set<string>(),
    };
    
    for (const pair of pairs) {
      const dexCount = new Set(pair.pools.map(p => p.dex)).size;
      stats.pairsPerDexCount.set(
        dexCount,
        (stats.pairsPerDexCount.get(dexCount) || 0) + 1
      );
      
      stats.tokensInvolved.add(pair.baseToken);
      stats.tokensInvolved.add(pair.quoteToken);
    }
    
    return {
      totalPairs: stats.totalPairs,
      pairsOn2Dexes: stats.pairsPerDexCount.get(2) || 0,
      uniqueTokens: stats.tokensInvolved.size,
    };
  }
}
