import { SuiClient } from '@mysten/sui/client';
import logger from '../src/utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const TURBOS_PACKAGE_ORIGINAL = '0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1';
const poolCreatedType = `${TURBOS_PACKAGE_ORIGINAL}::pool_factory::PoolCreatedEvent`;

async function debugTurbosEvents() {
  const rpcUrl = process.env.SUI_MAINNET_RPC || 'https://fullnode.mainnet.sui.io:443';
  logger.info({ rpcUrl }, 'Using RPC URL');
  
  const client = new SuiClient({
    url: rpcUrl,
  });

  logger.info('Fetching Turbos PoolCreated events...');
  
  const events = await client.queryEvents({
    query: { MoveEventType: poolCreatedType },
    limit: 5, // Just get 5 events to inspect
    order: 'descending',
  });

  logger.info({ eventCount: events.data.length }, 'Events fetched');

  // Print first 3 events in detail
  for (let i = 0; i < Math.min(3, events.data.length); i++) {
    const event = events.data[i];
    console.log(`\n========== Event ${i + 1} ==========`);
    console.log('Full event object:');
    console.log(JSON.stringify(event, null, 2));
    console.log('\nparsedJson:');
    console.log(JSON.stringify(event.parsedJson, null, 2));
  }
}

debugTurbosEvents().catch(console.error);
