import { config } from 'dotenv';
import { createSuiClient } from '../src/blockchain/client.js';
import { PoolRegistry } from '../src/dex/pool-registry.js';
import { PriceMonitor } from '../src/price/monitor.js';
import { formatPrice, shortenCoinType } from '../src/price/calculator.js';

config();

async function test() {
  const suiClient = createSuiClient('mainnet', [process.env.SUI_MAINNET_RPC!], 12);
  const client = suiClient.getClient();
  const registry = new PoolRegistry(client);
  
  console.log('Initializing...');
  await registry.initialize(['cetus', 'turbos']);
  
  const monitor = new PriceMonitor(client, registry);
  
  // Get a pool with reserves
  const pools = registry.getAllPools();
  console.log(`\nTotal pools: ${pools.length}`);
  
  // Find a pool that has non-zero reserves (after a refresh)
  console.log('\nRefreshing first 5 pools...');
  for (let i = 0; i < Math.min(5, pools.length); i++) {
    const pool = pools[i];
    console.log(`\nPool ${i + 1}:`);
    console.log(`  coinTypeA: ${shortenCoinType(pool.coinTypeA)}`);
    console.log(`  coinTypeB: ${shortenCoinType(pool.coinTypeB)}`);
    console.log(`  Before: reserveA=${pool.reserveA.toString()}, reserveB=${pool.reserveB.toString()}`);
    
    await monitor.updatePoolReserves(pool.poolId);
    
    console.log(`  After: reserveA=${pool.reserveA.toString()}, reserveB=${pool.reserveB.toString()}`);
    
    if (pool.reserveA > 0n && pool.reserveB > 0n) {
      console.log(`  ✅ Has liquidity!`);
      
      // Calculate price
      const prices = await monitor.getPrices(pool.coinTypeA, pool.coinTypeB);
      console.log(`  Prices found: ${prices.length}`);
      if (prices.length > 0) {
        console.log(`  Price: ${formatPrice(prices[0].price)}`);
      }
      break;
    }
  }
}

test().catch(console.error);
