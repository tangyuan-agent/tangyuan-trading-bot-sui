import { config } from 'dotenv';
import { createSuiClient } from '../src/blockchain/client.js';
import logger from '../src/utils/logger.js';

config();

async function debugTurbos() {
  const rateLimit = Number(process.env.SUI_MAINNET_RATE_LIMIT) || 12;
  const mainnetRpc = process.env.SUI_MAINNET_RPC;
  
  if (!mainnetRpc) {
    logger.error('SUI_MAINNET_RPC not set');
    process.exit(1);
  }
  
  const suiClient = createSuiClient('mainnet', [mainnetRpc], rateLimit);
  const client = suiClient.getClient();
  
  const TURBOS_PACKAGE = '0xa5a0c25c79e428eba04fb98b3fb2a34db45ab26d4c8faf0d7e39d66a63891e64';
  
  logger.info('🔍 Debugging Turbos event types...');
  
  // Try different event type patterns
  const eventPatterns = [
    `${TURBOS_PACKAGE}::pool::CreatePoolEvent`,
    `${TURBOS_PACKAGE}::pool::PoolCreatedEvent`,
    `${TURBOS_PACKAGE}::factory::CreatePoolEvent`,
    `${TURBOS_PACKAGE}::pool_factory::CreatePoolEvent`,
    `${TURBOS_PACKAGE}::pool_manager::CreatePoolEvent`,
  ];
  
  for (const eventType of eventPatterns) {
    logger.info({ eventType }, 'Testing event type...');
    
    try {
      const events = await client.queryEvents({
        query: { MoveEventType: eventType },
        limit: 5,
        order: 'descending',
      });
      
      logger.info({ 
        eventType, 
        count: events.data.length,
        hasNext: events.hasNextPage 
      }, 'Query result');
      
      if (events.data.length > 0) {
        logger.info('✅ Found events with this type!');
        logger.info({ sample: events.data[0] }, 'Sample event');
      }
    } catch (error) {
      logger.warn({ eventType, error }, 'Query failed');
    }
  }
  
  // Also try querying by package to see all event types
  logger.info('\n🔍 Querying all events from Turbos package...');
  
  try {
    const allEvents = await client.queryEvents({
      query: { MoveModule: { package: TURBOS_PACKAGE, module: 'pool' } },
      limit: 10,
      order: 'descending',
    });
    
    logger.info({ count: allEvents.data.length }, 'Events from pool module');
    
    if (allEvents.data.length > 0) {
      // Extract unique event types
      const eventTypes = new Set(allEvents.data.map(e => e.type));
      logger.info({ eventTypes: Array.from(eventTypes) }, 'Available event types');
      
      logger.info('Sample events:');
      allEvents.data.slice(0, 3).forEach((event, i) => {
        logger.info({ index: i, type: event.type, parsed: event.parsedJson });
      });
    }
  } catch (error) {
    logger.error({ error }, 'Failed to query pool module events');
  }
  
  // Try other modules
  const modules = ['pool_factory', 'factory', 'pool_manager', 'clmm_pool'];
  
  for (const module of modules) {
    try {
      logger.info({ module }, `\n🔍 Trying module: ${module}...`);
      const events = await client.queryEvents({
        query: { MoveModule: { package: TURBOS_PACKAGE, module } },
        limit: 5,
        order: 'descending',
      });
      
      if (events.data.length > 0) {
        logger.info({ module, count: events.data.length }, '✅ Found events in this module!');
        const eventTypes = new Set(events.data.map(e => e.type));
        logger.info({ eventTypes: Array.from(eventTypes) });
      }
    } catch (error) {
      logger.debug({ module }, 'Module not found or no events');
    }
  }
}

debugTurbos().catch(error => {
  logger.error({ error }, 'Debug failed');
  process.exit(1);
});
