import { SuiClient } from '@mysten/sui/client';
import { DEXAdapter, PoolInfo } from '../types.js';
import logger from '../../utils/logger.js';

// Turbos mainnet addresses (from official S3 config)
// Source: https://s3.amazonaws.com/app.turbos.finance/sdk/contract.json
// Note: Events are emitted from the ORIGINAL package, not the current one!
const TURBOS_PACKAGE_ORIGINAL = '0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1';
const TURBOS_PACKAGE_ID = '0xa5a0c25c79e428eba04fb98b3fb2a34db45ab26d4c8faf0d7e39d66a63891e64';

const TURBOS_CONFIG = {
  // Original package ID (for events)
  packageIdOriginal: TURBOS_PACKAGE_ORIGINAL,
  // Current package ID
  packageId: TURBOS_PACKAGE_ID,
  // Pool config object
  poolConfig: '0xc294552b2765353bcafa7c359cd28fd6bc237662e5db8f09877558d81669170c',
  // Pool table (registry)
  poolTableId: '0x08984ed8705f44b6403705dc248896e56ab7961447820ae29be935ce0d32198b',
  // Positions NFT collection
  positions: '0xf5762ae5ae19a2016bb233c72d9a4b2cba5a302237a82724af66292ae43ae52d',
  // Versioned object
  versioned: '0xf1cf0e81048df168ebeb1b8030fad24b3e0b53ae827c25053fff0779c1445b6f',
  // Pool creation event type (in pool_factory module of ORIGINAL package)
  poolCreatedType: `${TURBOS_PACKAGE_ORIGINAL}::pool_factory::PoolCreatedEvent`,
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
      
      // Strategy: Query all PoolCreated events with pagination
      const allPoolIds: string[] = [];
      let cursor: any = null;
      const maxPages = 10; // Fetch up to 10 pages (500 pools)
      
      for (let page = 0; page < maxPages; page++) {
        const events = await this.client.queryEvents({
          query: { MoveEventType: TURBOS_CONFIG.poolCreatedType },
          limit: 50,
          order: 'descending',
          cursor,
        });
        
        // Extract pool IDs from this page
        const poolIds = events.data
          .map(event => (event.parsedJson as any)?.pool as string)
          .filter((id): id is string => !!id);
        
        allPoolIds.push(...poolIds);
        
        if (!events.hasNextPage || !events.nextCursor) {
          break;
        }
        
        cursor = events.nextCursor;
      }
      
      logger.info({ poolCount: allPoolIds.length }, 'Turbos pool IDs collected');
      
      if (allPoolIds.length === 0) {
        logger.warn('No pool IDs found in events');
        return [];
      }
      
      logger.info({ poolCount: allPoolIds.length }, 'Fetching pool objects...');
      
      const poolIds = allPoolIds;
      
      // Batch fetch pool objects (50 at a time to respect rate limits)
      const pools: PoolInfo[] = [];
      const batchSize = 50;
      
      for (let i = 0; i < poolIds.length; i += batchSize) {
        const batch = poolIds.slice(i, i + batchSize);
        
        try {
          const objects = await this.client.multiGetObjects({
            ids: batch,
            options: {
              showType: true,
              showContent: true,
            },
          });
          
          for (const obj of objects) {
            try {
              const poolInfo = this.parsePoolFromObject(obj);
              if (poolInfo) {
                pools.push(poolInfo);
                this.poolCache.set(poolInfo.poolId, poolInfo);
              }
            } catch (error) {
              logger.debug({ error, objectId: obj.data?.objectId }, 'Failed to parse pool object');
            }
          }
          
          // Small delay between batches to be nice to the RPC
          if (i + batchSize < poolIds.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          logger.warn({ error, batchStart: i, batchSize }, 'Failed to fetch batch of pool objects');
        }
      }
      
      logger.info({ poolCount: pools.length }, 'Turbos pools loaded');
      return pools;
      
    } catch (error) {
      logger.error({ error }, 'Failed to fetch Turbos pools');
      throw error;
    }
  }
  
  private parsePoolFromObject(poolObject: any): PoolInfo | null {
    try {
      if (!poolObject.data || poolObject.data.content?.dataType !== 'moveObject') {
        return null;
      }
      
      const poolId = poolObject.data.objectId;
      
      // Parse type to extract token types
      // Format: 0x...::pool::Pool<TokenA, TokenB, FeeTier>
      const typeStr = poolObject.data.type as string;
      const typeMatch = typeStr.match(/Pool<([^,]+),\s*([^,]+),\s*([^>]+)>/);
      
      if (!typeMatch) {
        return null;
      }
      
      const [, coinTypeA, coinTypeB] = typeMatch;
      const fields = (poolObject.data.content as any).fields;
      
      return {
        dex: 'turbos',
        poolId,
        coinTypeA: coinTypeA.trim(),
        coinTypeB: coinTypeB.trim(),
        reserveA: BigInt(fields.coin_a || 0),
        reserveB: BigInt(fields.coin_b || 0),
        feeRate: fields.fee ? Number(fields.fee) / 1000000 : 0.003,
        lastUpdated: Date.now(),
      };
    } catch (error) {
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
