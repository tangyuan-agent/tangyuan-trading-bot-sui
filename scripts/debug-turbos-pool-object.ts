import { SuiClient } from '@mysten/sui/client';
import dotenv from 'dotenv';

dotenv.config();

async function debugTurbosPoolObject() {
  const rpcUrl = process.env.SUI_MAINNET_RPC || 'https://fullnode.mainnet.sui.io:443';
  const client = new SuiClient({ url: rpcUrl });

  // Use a pool ID from the events we just fetched
  const poolId = '0x7edad6c64c5c058262ec58553b7df484d7bcd7e2221403f42d790230b331dc49';
  
  console.log(`\nFetching pool object: ${poolId}\n`);
  
  const poolObject = await client.getObject({
    id: poolId,
    options: {
      showContent: true,
      showType: true,
    },
  });

  console.log('Pool object type:');
  console.log(poolObject.data?.type);
  console.log('\nPool object content:');
  console.log(JSON.stringify(poolObject.data?.content, null, 2));
}

debugTurbosPoolObject().catch(console.error);
