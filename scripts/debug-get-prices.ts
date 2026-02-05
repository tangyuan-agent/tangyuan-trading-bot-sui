import { config } from 'dotenv';
import { createSuiClient } from '../src/blockchain/client.js';
import { PoolRegistry } from '../src/dex/pool-registry.js';
import { PriceMonitor } from '../src/price/monitor.js';

config();

async function debugGetPrices() {
  const suiClient = createSuiClient('mainnet', [process.env.SUI_MAINNET_RPC!], 12);
  const client = suiClient.getClient();
  const registry = new PoolRegistry(client);
  
  await registry.initialize(['cetus']);
  
  const monitor = new PriceMonitor(client, registry);
  
  // Get first pool
  const pools = registry.getAllPools();
  const pool = pools[0];
  
  console.log('\n=== Pool Info ===');
  console.log('coinTypeA:', pool.coinTypeA);
  console.log('coinTypeB:', pool.coinTypeB);
  console.log('reserveA:', pool.reserveA.toString());
  console.log('reserveB:', pool.reserveB.toString());
  
  console.log('\n=== Getting Prices ===');
  const prices = monitor.getPrices(pool.coinTypeA, pool.coinTypeB);
  console.log('Prices found:', prices.length);
  
  if (prices.length === 0) {
    console.log('\n=== Debug: findPoolsForPair ===');
    const foundPools = registry.findPoolsForPair(pool.coinTypeA, pool.coinTypeB);
    console.log('Pools found:', foundPools.length);
    
    if (foundPools.length > 0) {
      const p = foundPools[0];
      console.log('First pool:');
      console.log('  coinTypeA:', p.coinTypeA);
      console.log('  coinTypeB:', p.coinTypeB);
      console.log('  reserveA:', p.reserveA.toString());
      console.log('  reserveB:', p.reserveB.toString());
      
      // Try to calculate price manually
      if (p.reserveA !== 0n) {
        const price = Number(p.reserveB) / Number(p.reserveA);
        console.log('  calculated price:', price);
      } else {
        console.log('  reserveA is zero!');
      }
    }
  }
}

debugGetPrices().catch(console.error);
