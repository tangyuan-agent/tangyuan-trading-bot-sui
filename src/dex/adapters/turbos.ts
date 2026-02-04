import { SuiClient } from '@mysten/sui/client';
import { DEXAdapter, PoolInfo } from '../types.js';
import logger from '../../utils/logger.js';

// Turbos mainnet addresses
// TODO: Update with actual mainnet addresses
const TURBOS_CONFIG = {
  // Global pool registry
  poolRegistryId: '0x...',
  // Package ID
  packageId: '0x...',
  // Pool creation event
  poolCreatedType: '0x...',
};

export class TurbosAdapter implements DEXAdapter {
  name = 'turbos' as const;
  private client: SuiClient;
  private poolCache: Map<string, PoolInfo> = new Map();
  
  constructor(client: SuiClient) {
    this.client = client;
  }
  
  async fetchPools(): Promise<PoolInfo[]> {
    try {
      logger.info('Fetching Turbos pools...');
      
      // Strategy: Query all PoolCreated events
      const events = await this.client.queryEvents({
        query: { MoveEventType: TURBOS_CONFIG.poolCreatedType },
        limit: 1000,
        order: 'descending',
      });
      
      logger.info({ eventCount: events.data.length }, 'Turbos events fetched');
      
      const pools: PoolInfo[] = [];
      
      for (const event of events.data) {
        try {
          const poolInfo = this.parsePoolEvent(event);
          if (poolInfo) {
            pools.push(poolInfo);
            this.poolCache.set(poolInfo.poolId, poolInfo);
          }
        } catch (error) {
          logger.warn({ error, event }, 'Failed to parse Turbos pool event');
        }
      }
      
      logger.info({ poolCount: pools.length }, 'Turbos pools loaded');
      return pools;
      
    } catch (error) {
      logger.error({ error }, 'Failed to fetch Turbos pools');
      throw error;
    }
  }
  
  private parsePoolEvent(event: any): PoolInfo | null {
    try {
      const parsed = event.parsedJson;
      
      if (!parsed.pool_id && !parsed.poolId) {
        return null;
      }
      
      return {
        dex: 'turbos',
        poolId: parsed.pool_id || parsed.poolId,
        coinTypeA: parsed.coin_type_a || parsed.coinTypeA || parsed.token_a,
        coinTypeB: parsed.coin_type_b || parsed.coinTypeB || parsed.token_b,
        reserveA: 0n,
        reserveB: 0n,
        feeRate: parsed.fee_rate ? Number(parsed.fee_rate) / 1000000 : 0.003,
        lastUpdated: Date.now(),
      };
    } catch (error) {
      logger.warn({ error }, 'Failed to parse Turbos pool event');
      return null;
    }
  }
  
  async getPoolReserves(poolId: string): Promise<{
    reserveA: bigint;
    reserveB: bigint;
  }> {
    try {
      const poolObject = await this.client.getObject({
        id: poolId,
        options: {
          showContent: true,
        },
      });
      
      if (poolObject.data?.content?.dataType !== 'moveObject') {
        throw new Error('Invalid pool object');
      }
      
      const fields = (poolObject.data.content as any).fields;
      
      // Parse reserves - field names may vary
      const reserveA = BigInt(fields.reserve_a || fields.balance_a || 0);
      const reserveB = BigInt(fields.reserve_b || fields.balance_b || 0);
      
      return { reserveA, reserveB };
      
    } catch (error) {
      logger.error({ error, poolId }, 'Failed to get Turbos pool reserves');
      throw error;
    }
  }
  
  calculateAmountOut(
    amountIn: bigint,
    reserveIn: bigint,
    reserveOut: bigint
  ): bigint {
    const feeRate = 0.003;
    if (amountIn === 0n || reserveIn === 0n || reserveOut === 0n) {
      return 0n;
    }
    
    // Same constant product formula as Cetus
    const amountInWithFee = amountIn * BigInt(Math.floor((1 - feeRate) * 10000)) / 10000n;
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn + amountInWithFee;
    
    return numerator / denominator;
  }
}
