import { SuiClient } from '@mysten/sui/client';
import { DEXAdapter, PoolInfo } from '../types.js';
import logger from '../../utils/logger.js';

// Turbos mainnet addresses (from official S3 config)
// Source: https://s3.amazonaws.com/app.turbos.finance/sdk/contract.json
const TURBOS_PACKAGE_ID = '0xa5a0c25c79e428eba04fb98b3fb2a34db45ab26d4c8faf0d7e39d66a63891e64';

const TURBOS_CONFIG = {
  // Package ID
  packageId: TURBOS_PACKAGE_ID,
  // Pool config object
  poolConfig: '0xc294552b2765353bcafa7c359cd28fd6bc237662e5db8f09877558d81669170c',
  // Pool table (registry)
  poolTableId: '0x08984ed8705f44b6403705dc248896e56ab7961447820ae29be935ce0d32198b',
  // Positions NFT collection
  positions: '0xf5762ae5ae19a2016bb233c72d9a4b2cba5a302237a82724af66292ae43ae52d',
  // Versioned object
  versioned: '0xf1cf0e81048df168ebeb1b8030fad24b3e0b53ae827c25053fff0779c1445b6f',
  // Pool creation event type
  poolCreatedType: `${TURBOS_PACKAGE_ID}::pool::CreatePoolEvent`,
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
