import { config } from 'dotenv';
import { createSuiClient } from '../src/blockchain/client.js';
import { PoolRegistry } from '../src/dex/pool-registry.js';

config();

async function debugPoolReserves() {
  const suiClient = createSuiClient('mainnet', [process.env.SUI_MAINNET_RPC!], 12);
  const client = suiClient.getClient();
  const registry = new PoolRegistry(client);
  
  console.log('Initializing...');
  await registry.initialize(['cetus']);
  
  const pools = registry.getAllPools();
  const pool = pools[0];
  
  console.log(`\nFetching pool object: ${pool.poolId}`);
  
  const poolObject = await client.getObject({
    id: pool.poolId,
    options: {
      showContent: true,
      showType: true,
    },
  });

  console.log('\nPool type:', poolObject.data?.type);
  console.log('\nPool content:');
  console.log(JSON.stringify(poolObject.data?.content, null, 2));
}

debugPoolReserves().catch(console.error);
