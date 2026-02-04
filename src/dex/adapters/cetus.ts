import { SuiClient } from '@mysten/sui/client';
import { DEXAdapter, PoolInfo } from '../types.js';
import logger from '../../utils/logger.js';

// Cetus mainnet addresses
// TODO: Update with actual mainnet addresses
const CETUS_CONFIG = {
  // Global config object that contains pool registry
  globalConfigId: '0xdaa46292632c3c4d8f31f23ea0f9b36a28ff3677e9684980e4438403a67a3d8f',
  // Package ID
  packageId: '0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb',
  // Pool creation event
  poolCreatedType: '0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb::factory::PoolCreatedEvent',
};

export class CetusAdapter implements DEXAdapter {
  name = 'cetus' as const;
  private client: SuiClient;
  private poolCache: Map<string, PoolInfo> = new Map();
  
  constructor(client: SuiClient) {
    this.client = client;
  }
  
  async fetchPools(): Promise<PoolInfo[]> {
    try {
      logger.info('Fetching Cetus pools...');
      
      // Strategy: Query all PoolCreated events from the factory
      // This gives us a complete list of pools
      const events = await this.client.queryEvents({
        query: { MoveEventType: CETUS_CONFIG.poolCreatedType },
        limit: 1000, // Adjust based on actual pool count
        order: 'descending',
      });
      
      logger.info({ eventCount: events.data.length }, 'Cetus events fetched');
      
      const pools: PoolInfo[] = [];
      
      for (const event of events.data) {
        try {
          const poolInfo = this.parsePoolEvent(event);
          if (poolInfo) {
            pools.push(poolInfo);
            this.poolCache.set(poolInfo.poolId, poolInfo);
          }
        } catch (error) {
          logger.warn({ error, event }, 'Failed to parse Cetus pool event');
        }
      }
      
      logger.info({ poolCount: pools.length }, 'Cetus pools loaded');
      return pools;
      
    } catch (error) {
      logger.error({ error }, 'Failed to fetch Cetus pools');
      throw error;
    }
  }
  
  private parsePoolEvent(event: any): PoolInfo | null {
    try {
      const parsed = event.parsedJson;
      
      // Event structure (example - adjust based on actual event):
      // {
      //   pool_id: "0x...",
      //   coin_type_a: "0x2::sui::SUI",
      //   coin_type_b: "0x...",
      //   fee_rate: 3000, // 0.3% = 3000/1000000
      // }
      
      if (!parsed.pool_id) {
        return null;
      }
      
      return {
        dex: 'cetus',
        poolId: parsed.pool_id,
        coinTypeA: parsed.coin_type_a || parsed.coinTypeA,
        coinTypeB: parsed.coin_type_b || parsed.coinTypeB,
        reserveA: 0n, // Will be fetched separately
        reserveB: 0n,
        feeRate: parsed.fee_rate ? Number(parsed.fee_rate) / 1000000 : 0.003,
        lastUpdated: Date.now(),
      };
    } catch (error) {
      logger.warn({ error }, 'Failed to parse Cetus pool event');
      return null;
    }
  }
  
  async getPoolReserves(poolId: string): Promise<{
    reserveA: bigint;
    reserveB: bigint;
  }> {
    try {
      // Fetch pool object to get current reserves
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
      
      // Parse reserves from pool object fields
      // Field names may vary - adjust based on actual contract
      const reserveA = BigInt(fields.coin_a_balance || fields.reserve_a || 0);
      const reserveB = BigInt(fields.coin_b_balance || fields.reserve_b || 0);
      
      return { reserveA, reserveB };
      
    } catch (error) {
      logger.error({ error, poolId }, 'Failed to get Cetus pool reserves');
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
    
    // Constant product formula: x * y = k
    // With fee: amountOut = (amountIn * 0.997 * reserveOut) / (reserveIn + amountIn * 0.997)
    const amountInWithFee = amountIn * BigInt(Math.floor((1 - feeRate) * 10000)) / 10000n;
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn + amountInWithFee;
    
    return numerator / denominator;
  }
}
