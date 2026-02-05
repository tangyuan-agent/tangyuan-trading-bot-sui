import { config } from 'dotenv';
import { createSuiClient } from '../src/blockchain/client.js';
import { PoolRegistry } from '../src/dex/pool-registry.js';
import { PriceMonitor } from '../src/price/monitor.js';
import { ArbitragePairFinder } from '../src/arbitrage/pair-finder.js';
import { SpreadMonitor } from '../src/arbitrage/spread-monitor.js';
import { shortenCoinType, formatSpread, formatPrice } from '../src/price/calculator.js';
import logger from '../src/utils/logger.js';

config();

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║      Tangyuan Trading Bot - Arbitrage Monitor             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Step 1: Initialize
  console.log('📡 Step 1: Connecting to Sui Mainnet...');
  const suiClient = createSuiClient('mainnet', [process.env.SUI_MAINNET_RPC!], 12);
  const client = suiClient.getClient();
  console.log('   ✅ Connected\n');

  console.log('🔍 Step 2: Scanning all DEX pools...');
  const registry = new PoolRegistry(client);
  await registry.initialize(['cetus', 'turbos']);
  
  const cetusPools = registry.getPoolsByDex('cetus');
  const turbosPools = registry.getPoolsByDex('turbos');
  const allPools = registry.getAllPools();
  
  console.log(`   ✅ Cetus: ${cetusPools.length} pools`);
  console.log(`   ✅ Turbos: ${turbosPools.length} pools`);
  console.log(`   📊 Total: ${allPools.length} pools\n`);

  // Step 2: Find cross-DEX pairs
  console.log('🔎 Step 3: Finding cross-DEX pairs...');
  const pairFinder = new ArbitragePairFinder(registry);
  const crossDexPairs = pairFinder.findCrossDexPairs();
  
  const stats = pairFinder.getStatistics();
  console.log(`   ✅ Found ${stats.totalPairs} pairs available on multiple DEXes`);
  console.log(`   📊 Pairs on 2 DEXes: ${stats.pairsOn2Dexes}`);
  console.log(`   🪙  Unique tokens: ${stats.uniqueTokens}\n`);

  if (crossDexPairs.length === 0) {
    console.log('   ⚠️  No cross-DEX pairs found. Try increasing pool fetch limit.\n');
    process.exit(0);
  }

  // Step 3: Display sample pairs
  console.log('📋 Step 4: Sample cross-DEX pairs:');
  console.log('─'.repeat(60));
  
  crossDexPairs.slice(0, 5).forEach((pair, index) => {
    const dexes = pair.pools.map(p => p.dex).join(' + ');
    console.log(`   ${index + 1}. ${shortenCoinType(pair.baseToken)} / ${shortenCoinType(pair.quoteToken)}`);
    console.log(`      DEXes: ${dexes} (${pair.pools.length} pools)`);
  });
  console.log('─'.repeat(60) + '\n');

  // Step 4: Save pairs to file
  const pairsFile = '.tangyuan/cross-dex-pairs.json';
  const pairsData = {
    timestamp: new Date().toISOString(),
    count: crossDexPairs.length,
    pairs: crossDexPairs.map(pair => ({
      baseToken: pair.baseToken,
      quoteToken: pair.quoteToken,
      baseSymbol: shortenCoinType(pair.baseToken),
      quoteSymbol: shortenCoinType(pair.quoteToken),
      pools: pair.pools.map(p => ({
        dex: p.dex,
        poolId: p.poolId,
      })),
    })),
  };
  
  const fs = await import('fs');
  const path = await import('path');
  const dir = path.dirname(pairsFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(pairsFile, JSON.stringify(pairsData, null, 2));
  console.log(`💾 Step 5: Saved pairs to ${pairsFile}\n`);

  // Step 5: Initialize spread monitor
  console.log('📊 Step 6: Initializing spread monitor...');
  const priceMonitor = new PriceMonitor(client, registry);
  const spreadMonitor = new SpreadMonitor(client, registry, priceMonitor, {
    minSpread: 0.5, // 0.5%
    checkInterval: 30000, // 30 seconds
    autoRefresh: true,
  });
  
  spreadMonitor.loadPairs(crossDexPairs);
  console.log('   ✅ Monitor configured\n');

  // Step 6: Run initial check
  console.log('🔍 Step 7: Running initial price check...');
  console.log('   (This may take a while - checking reserves for all pairs)\n');
  
  await spreadMonitor.start();
  
  // Wait for first check to complete
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const opportunities = spreadMonitor.getTopOpportunities(10);
  
  console.log('─'.repeat(60));
  console.log(`🎯 Found ${opportunities.length} arbitrage opportunities\n`);
  
  if (opportunities.length > 0) {
    console.log('Top opportunities:');
    console.log('─'.repeat(60));
    
    opportunities.slice(0, 5).forEach((opp, index) => {
      console.log(`\n${index + 1}. ${shortenCoinType(opp.pair.baseToken)} / ${shortenCoinType(opp.pair.quoteToken)}`);
      console.log(`   Spread: ${formatSpread(opp.spreadPercent)}`);
      console.log(`   Buy:  ${opp.buyDex.padEnd(8)} @ ${formatPrice(opp.buyPrice)}`);
      console.log(`   Sell: ${opp.sellDex.padEnd(8)} @ ${formatPrice(opp.sellPrice)}`);
      console.log(`   Profit: ${formatSpread(opp.spreadPercent)} (before fees)`);
    });
    
    console.log('\n' + '─'.repeat(60));
    
    // Save opportunities
    const oppFile = '.tangyuan/arbitrage-opportunities.json';
    await spreadMonitor.saveOpportunities(oppFile);
    console.log(`\n💾 Saved opportunities to ${oppFile}`);
  } else {
    console.log('   ℹ️  No significant opportunities at this time.');
    console.log('   💡 This is normal - arbitrage opportunities are rare and fleeting.\n');
  }

  // Step 7: Continue monitoring
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                Monitoring Started ✅                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log('📊 Monitor status:');
  const monitorStats = spreadMonitor.getStats();
  console.log(`   Pairs: ${monitorStats.pairsMonitored}`);
  console.log(`   Check interval: ${monitorStats.config.checkInterval / 1000}s`);
  console.log(`   Min spread: ${monitorStats.config.minSpread}%`);
  console.log('');
  console.log('💡 Monitor will check prices every 30 seconds.');
  console.log('   Press Ctrl+C to stop.\n');

  // Keep running and show periodic updates
  let checkCount = 0;
  setInterval(() => {
    checkCount++;
    const stats = spreadMonitor.getStats();
    const recentOpps = spreadMonitor.getOpportunities(0.5);
    
    console.log(`[${new Date().toLocaleTimeString()}] Check #${checkCount} - ` +
                `${stats.recentOpportunities} opportunities in last minute ` +
                `(total: ${recentOpps.length})`);
    
    // Show any new high-spread opportunities
    const highSpreadOpps = recentOpps.filter(opp => opp.spreadPercent >= 1.0);
    if (highSpreadOpps.length > 0) {
      console.log(`   🔥 ${highSpreadOpps.length} opportunities with >1% spread!`);
    }
  }, 30000);

  // Handle shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down...');
    spreadMonitor.stop();
    process.exit(0);
  });
}

main().catch(error => {
  logger.error({ error }, 'Fatal error');
  process.exit(1);
});
