import { config } from 'dotenv';
import { createSuiClient } from '../src/blockchain/client.js';
import { PoolRegistry } from '../src/dex/pool-registry.js';

config();

async function debug() {
  const suiClient = createSuiClient('mainnet', [process.env.SUI_MAINNET_RPC!], 12);
  const client = suiClient.getClient();
  const registry = new PoolRegistry(client);
  
  await registry.initialize(['cetus', 'turbos']);
  
  const cetusPools = registry.getPoolsByDex('cetus');
  const turbosPools = registry.getPoolsByDex('turbos');
  
  console.log(`\nCetus pools: ${cetusPools.length}`);
  console.log(`Turbos pools: ${turbosPools.length}\n`);
  
  // Sample tokens from each DEX
  const cetusTokens = new Set<string>();
  const turbosTokens = new Set<string>();
  
  cetusPools.slice(0, 10).forEach(p => {
    cetusTokens.add(p.coinTypeA);
    cetusTokens.add(p.coinTypeB);
  });
  
  turbosPools.slice(0, 10).forEach(p => {
    turbosTokens.add(p.coinTypeA);
    turbosTokens.add(p.coinTypeB);
  });
  
  console.log('Sample Cetus tokens:');
  Array.from(cetusTokens).slice(0, 5).forEach(t => {
    console.log(`  ${t.substring(0, 66)}...`);
  });
  
  console.log('\nSample Turbos tokens:');
  Array.from(turbosTokens).slice(0, 5).forEach(t => {
    console.log(`  ${t.substring(0, 66)}...`);
  });
  
  // Check for common tokens
  const commonTokens = Array.from(cetusTokens).filter(t => turbosTokens.has(t));
  console.log(`\nCommon tokens: ${commonTokens.length}`);
  
  if (commonTokens.length > 0) {
    console.log('Examples:');
    commonTokens.slice(0, 3).forEach(t => {
      console.log(`  ${t}`);
    });
  }
  
  // Check pairs with normalized keys
  const cetusPairs = new Map<string, any>();
  const turbosPairs = new Map<string, any>();
  
  cetusPools.forEach(p => {
    const tokens = [p.coinTypeA, p.coinTypeB].sort();
    const key = `${tokens[0]}::${tokens[1]}`;
    cetusPairs.set(key, p);
  });
  
  turbosPools.forEach(p => {
    const tokens = [p.coinTypeA, p.coinTypeB].sort();
    const key = `${tokens[0]}::${tokens[1]}`;
    turbosPairs.set(key, p);
  });
  
  const commonPairs = Array.from(cetusPairs.keys()).filter(k => turbosPairs.has(k));
  
  console.log(`\nCetus unique pairs: ${cetusPairs.size}`);
  console.log(`Turbos unique pairs: ${turbosPairs.size}`);
  console.log(`Common pairs: ${commonPairs.length}`);
  
  if (commonPairs.length > 0) {
    console.log('\nExamples:');
    commonPairs.slice(0, 5).forEach(k => {
      const [tokenA, tokenB] = k.split('::');
      const shortenToken = (t: string) => {
        const parts = t.split('::');
        return parts.length >= 3 ? parts[parts.length - 1] : t.substring(0, 10);
      };
      console.log(`  ${shortenToken(tokenA)} / ${shortenToken(tokenB)}`);
    });
  }
}

debug().catch(console.error);
