import { config } from 'dotenv';
import { createSuiClient } from '../src/blockchain/client.js';
import logger from '../src/utils/logger.js';

config();

async function findTurbosPools() {
  const rateLimit = Number(process.env.SUI_MAINNET_RATE_LIMIT) || 12;
  const mainnetRpc = process.env.SUI_MAINNET_RPC;
  
  if (!mainnetRpc) {
    logger.error('SUI_MAINNET_RPC not set');
    process.exit(1);
  }
  
  const suiClient = createSuiClient('mainnet', [mainnetRpc], rateLimit);
  const client = suiClient.getClient();
  
  const ORIGINAL_PACKAGE = '0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1';
  
  logger.info('🔍 Looking for pool creation events in original package...');
  
  // Query pool object from a SwapEvent to understand structure
  logger.info('📊 Fetching a pool object to understand structure...');
  
  const SAMPLE_POOL = '0x6f7331d546142cfd1d23cf9eda0fb8a14c2b53b1eac440ddd27608f0e6e02cc6';
  
  try {
    const poolObject = await client.getObject({
      id: SAMPLE_POOL,
      options: {
        showType: true,
        showContent: true,
      },
    });
    
    logger.info({ pool: poolObject }, 'Sample pool object');
  } catch (error) {
    logger.error({ error }, 'Failed to fetch pool');
  }
  
  // Try to find pool creation events in original package
  logger.info('\n🔍 Searching for pool creation events...');
  
  const modules = ['pool', 'pool_factory', 'factory', 'pool_manager'];
  
  for (const module of modules) {
    logger.info({ module }, `Checking module: ${module}`);
    
    try {
      const events = await client.queryEvents({
        query: { MoveModule: { package: ORIGINAL_PACKAGE, module } },
        limit: 50,
        order: 'ascending', // Start from oldest
      });
      
      if (events.data.length > 0) {
        const eventTypes = new Set(events.data.map(e => e.type));
        logger.info({ module, eventTypes: Array.from(eventTypes) }, 'Event types found');
        
        // Look for creation events
        const creationEvents = events.data.filter(e => 
          e.type.toLowerCase().includes('creat') || 
          e.type.toLowerCase().includes('init')
        );
        
        if (creationEvents.length > 0) {
          logger.info(`✅ Found ${creationEvents.length} creation events!`);
          logger.info({ sample: creationEvents[0] }, 'Sample creation event');
        }
      }
    } catch (error) {
      logger.debug({ module, error }, 'Module check failed');
    }
  }
  
  // Alternative: List all pools from PoolTableId
  logger.info('\n🔍 Alternative: Query pools from PoolTableId...');
  
  const POOL_TABLE_ID = '0x08984ed8705f44b6403705dc248896e56ab7961447820ae29be935ce0d32198b';
  
  try {
    const poolTable = await client.getDynamicFields({
      parentId: POOL_TABLE_ID,
      limit: 10,
    });
    
    logger.info({ 
      poolCount: poolTable.data.length,
      hasNext: poolTable.hasNextPage 
    }, 'Pools from table');
    
    if (poolTable.data.length > 0) {
      logger.info({ sample: poolTable.data[0] }, 'Sample pool table entry');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to query pool table');
  }
}

findTurbosPools().catch(error => {
  logger.error({ error }, 'Search failed');
  process.exit(1);
});
