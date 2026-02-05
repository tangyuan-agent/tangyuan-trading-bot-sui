import { config } from 'dotenv';
import { createSuiClient } from '../src/blockchain/client.js';
import { PoolRegistry } from '../src/dex/pool-registry.js';

config();

async function debugPoolStructure() {
  const suiClient = createSuiClient('mainnet', [process.env.SUI_MAINNET_RPC!], 12);
  const client = suiClient.getClient();
  const registry = new PoolRegistry(client);
  
  await registry.initialize(['cetus']);
  const pools = registry.getAllPools();
  
  console.log('\n=== First Pool ===');
  const pool = pools[0];
  console.log('poolId:', pool.poolId);
  console.log('dex:', pool.dex);
  console.log('coinTypeA:', pool.coinTypeA);
  console.log('coinTypeB:', pool.coinTypeB);
  console.log('reserveA:', pool.reserveA.toString());
  console.log('reserveB:', pool.reserveB.toString());
  console.log('feeRate:', pool.feeRate);
  console.log('lastUpdated:', pool.lastUpdated);
  
  console.log('\n=== Testing getAllPairs ===');
  const pairs = registry.getAllPools().flatMap(p => [
    { base: p.coinTypeA, quote: p.coinTypeB },
    { base: p.coinTypeB, quote: p.coinTypeA }
  ]);
  
  console.log('Total pairs:', pairs.length);
  console.log('First pair:', pairs[0]);
}

debugPoolStructure().catch(console.error);
