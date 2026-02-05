import { config } from 'dotenv';
import { createSuiClient } from '../src/blockchain/client.js';
import { PoolRegistry } from '../src/dex/pool-registry.js';
import { PriceMonitor } from '../src/price/monitor.js';
import { formatPrice, formatSpread, shortenCoinType } from '../src/price/calculator.js';

config();

async function demo() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       Tangyuan Trading Bot - Price System Demo            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Initialize
  console.log('📡 Step 1: Connecting to Sui Mainnet...');
  const suiClient = createSuiClient('mainnet', [process.env.SUI_MAINNET_RPC!], 12);
  const client = suiClient.getClient();
  console.log('   ✅ Connected to QuickNode RPC\n');

  console.log('🔍 Step 2: Scanning DEX pools...');
  const registry = new PoolRegistry(client);
  await registry.initialize(['cetus', 'turbos']);
  
  const allPools = registry.getAllPools();
  const cetusPools = registry.getPoolsByDex('cetus');
  const turbosPools = registry.getPoolsByDex('turbos');
  
  console.log(`   ✅ Cetus: ${cetusPools.length} pools`);
  console.log(`   ✅ Turbos: ${turbosPools.length} pools`);
  console.log(`   📊 Total: ${allPools.length} pools, ${registry.getAllTokens().length} unique tokens\n`);

  console.log('💰 Step 3: Analyzing liquidity...');
  const priceMonitor = new PriceMonitor(client, registry);
  
  // Find pools with liquidity
  let poolsWithLiquidity = 0;
  const samplePools = [];
  
  for (const pool of allPools.slice(0, 20)) {
    await priceMonitor.updatePoolReserves(pool.poolId);
    if (pool.reserveA > 0n && pool.reserveB > 0n) {
      poolsWithLiquidity++;
      if (samplePools.length < 5) {
        samplePools.push(pool);
      }
    }
  }
  
  console.log(`   ✅ Found ${poolsWithLiquidity} pools with liquidity (checked first 20)\n`);

  console.log('📈 Step 4: Price calculation demo...');
  console.log('─'.repeat(60));
  
  for (let i = 0; i < Math.min(3, samplePools.length); i++) {
    const pool = samplePools[i];
    console.log(`\n   Pool #${i + 1} [${pool.dex.toUpperCase()}]`);
    console.log(`   Token A: ${shortenCoinType(pool.coinTypeA)}`);
    console.log(`   Token B: ${shortenCoinType(pool.coinTypeB)}`);
    console.log(`   Reserve A: ${pool.reserveA.toString()}`);
    console.log(`   Reserve B: ${pool.reserveB.toString()}`);
    
    const price = Number(pool.reserveB) / Number(pool.reserveA);
    console.log(`   💵 Price: ${formatPrice(price)} ${shortenCoinType(pool.coinTypeB)} per ${shortenCoinType(pool.coinTypeA)}`);
  }
  
  console.log('\n' + '─'.repeat(60) + '\n');

  console.log('🔄 Step 5: Cross-DEX price comparison...');
  
  // Find a pair that exists on multiple DEXes
  const pairMap = new Map<string, typeof allPools>();
  
  for (const pool of allPools) {
    if (pool.reserveA > 0n && pool.reserveB > 0n) {
      const key = `${pool.coinTypeA}:${pool.coinTypeB}`;
      if (!pairMap.has(key)) {
        pairMap.set(key, []);
      }
      pairMap.get(key)!.push(pool);
    }
  }
  
  // Find pairs with 2+ DEXes
  const multiDexPairs = Array.from(pairMap.entries())
    .filter(([_, pools]) => {
      const dexes = new Set(pools.map(p => p.dex));
      return dexes.size >= 2;
    });
  
  if (multiDexPairs.length > 0) {
    console.log(`   ✅ Found ${multiDexPairs.length} pairs available on multiple DEXes\n`);
    
    // Show first pair
    const [pairKey, pools] = multiDexPairs[0];
    const [baseToken, quoteToken] = pairKey.split(':');
    
    console.log('   Example: Cross-DEX comparison');
    console.log('   ─'.repeat(58));
    console.log(`   Pair: ${shortenCoinType(baseToken)} / ${shortenCoinType(quoteToken)}`);
    
    const prices = await priceMonitor.getPrices(baseToken, quoteToken);
    
    prices.forEach(p => {
      console.log(`   ${p.dex.padEnd(8)} → ${formatPrice(p.price).padStart(15)} ${shortenCoinType(quoteToken)}`);
    });
    
    if (prices.length >= 2) {
      const sortedPrices = [...prices].sort((a, b) => a.price - b.price);
      const spread = ((sortedPrices[sortedPrices.length - 1].price - sortedPrices[0].price) / sortedPrices[0].price) * 100;
      console.log(`\n   📊 Price spread: ${formatSpread(spread)}`);
      
      if (spread > 0.1) {
        console.log(`   🎯 Arbitrage opportunity detected!`);
        console.log(`      Buy on: ${sortedPrices[0].dex} @ ${formatPrice(sortedPrices[0].price)}`);
        console.log(`      Sell on: ${sortedPrices[sortedPrices.length - 1].dex} @ ${formatPrice(sortedPrices[sortedPrices.length - 1].price)}`);
        console.log(`      Potential profit: ${formatSpread(spread)}`);
      }
    }
  } else {
    console.log(`   ⚠️  No pairs found on multiple DEXes (need to refresh more pools)\n`);
  }
  
  console.log('\n' + '─'.repeat(60) + '\n');

  console.log('🎯 Step 6: Arbitrage opportunity scan...');
  console.log('   Scanning all pairs with price spread > 0.5%...\n');
  
  const opportunities = await priceMonitor.findArbitrageOpportunities(0.5, false);
  
  if (opportunities.length > 0) {
    console.log(`   ✅ Found ${opportunities.length} arbitrage opportunities!\n`);
    
    // Show top 3
    opportunities.slice(0, 3).forEach((opp, index) => {
      console.log(`   Opportunity #${index + 1}`);
      console.log(`   ─────────────────────────────────────────────────────`);
      console.log(`   Pair: ${shortenCoinType(opp.baseToken)} / ${shortenCoinType(opp.quoteToken)}`);
      console.log(`   Spread: ${formatSpread(opp.spreadPercent)}`);
      console.log(`   Buy:  ${opp.bestBuy.dex.padEnd(8)} @ ${formatPrice(opp.bestBuy.price)}`);
      console.log(`   Sell: ${opp.bestSell.dex.padEnd(8)} @ ${formatPrice(opp.bestSell.price)}`);
      console.log(`   Profit: ${formatSpread(opp.spreadPercent)} (before fees)\n`);
    });
  } else {
    console.log(`   ℹ️  No significant arbitrage opportunities found at this time.\n`);
    console.log(`   💡 Tip: Most pools need reserves refresh. Try running with refresh=true\n`);
  }

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    Demo Complete! ✅                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log('📋 Summary:');
  console.log(`   • Total pools scanned: ${allPools.length}`);
  console.log(`   • Pools with liquidity: ${poolsWithLiquidity}+ (sampled)`);
  console.log(`   • Cross-DEX pairs: ${multiDexPairs.length}`);
  console.log(`   • Arbitrage opportunities: ${opportunities.length}`);
  console.log('');
  console.log('🚀 Next steps:');
  console.log('   1. Implement automated arbitrage execution');
  console.log('   2. Add gas cost calculation');
  console.log('   3. Real-time price monitoring');
  console.log('   4. Profit optimization strategies');
}

demo().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
