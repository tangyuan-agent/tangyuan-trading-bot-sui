import { config } from 'dotenv';
import { createSuiClient } from '../src/blockchain/client.js';

config();

async function debugPagination() {
  const suiClient = createSuiClient('mainnet', [process.env.SUI_MAINNET_RPC!], 12);
  const client = suiClient.getClient();
  
  const CETUS_PACKAGE_ID = '0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb';
  const poolCreatedType = `${CETUS_PACKAGE_ID}::factory::CreatePoolEvent`;
  
  console.log('Testing event pagination for Cetus...\n');
  
  // First page
  const page1 = await client.queryEvents({
    query: { MoveEventType: poolCreatedType },
    limit: 50,
    order: 'descending',
  });
  
  console.log(`Page 1: ${page1.data.length} events`);
  console.log(`Has next page: ${page1.hasNextPage}`);
  console.log(`Next cursor: ${page1.nextCursor}\n`);
  
  if (page1.hasNextPage && page1.nextCursor) {
    // Second page
    const page2 = await client.queryEvents({
      query: { MoveEventType: poolCreatedType },
      limit: 50,
      order: 'descending',
      cursor: page1.nextCursor,
    });
    
    console.log(`Page 2: ${page2.data.length} events`);
    console.log(`Has next page: ${page2.hasNextPage}`);
    
    // Total
    console.log(`\nTotal events across 2 pages: ${page1.data.length + page2.data.length}`);
  } else {
    console.log('No more pages available');
  }
}

debugPagination().catch(console.error);
