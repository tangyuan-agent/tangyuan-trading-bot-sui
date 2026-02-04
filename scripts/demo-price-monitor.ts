import { config } from 'dotenv';
import { createSuiClient } from '../src/blockchain/client.js';
import { PoolRegistry } from '../src/dex/pool-registry.js';
import logger from '../src/utils/logger.js';

config();

async function monitorPrices() {
  logger.info('🚀 Starting price monitor demo...');
  
  const rateLimit = Number(process.env.SUI_MAINNET_RATE_LIMIT) || 12;
  const mainnetRpc = process.env.SUI_MAINNET_RPC;
  
  if (!mainnetRpc) {
    logger.error('SUI_MAINNET_RPC not set');
    process.exit(1);
  }
  
  const suiClient = createSuiClient('mainnet', [mainnetRpc], rateLimit);
  const client = suiClient.getClient();
  const registry = new PoolRegistry(client);
  
  // Initialize registry
  logger.info('📊 Fetching pools from DEXes...');
  await registry.initialize(['cetus', 'turbos']);
  
  const allPools = registry.getAllPools();
  logger.info({ poolCount: allPools.length }, '✅ Pools loaded');
  
  // Find some common pairs to monitor
  const SUI_TYPE = '0x2::sui::SUI';
  const commonTokens = Array.from(new Set(
    allPools.flatMap(p => [p.coinTypeA, p.coinTypeB])
  )).slice(0, 10); // Monitor first 10 unique tokens
  
  logger.info({ tokenCount: commonTokens.length }, '🎯 Monitoring tokens');
  
  // Start monitoring loop
  let iteration = 0;
  
  while (true) {
    iteration++;
    const timestamp = new Date().toISOString().substring(11, 19);
    
    logger.info({ iteration }, `\n${'='.repeat(60)}`);
    logger.info(`[${timestamp}] 📈 Price Update #${iteration}`);
    logger.info('='.repeat(60));
    
    // Refresh pool reserves for a small sample (to avoid rate limit)
    // Only refresh 5 pools per iteration
    const samplePools = allPools.slice(0, Math.min(5, allPools.length));
    
    // Refresh one by one with delay
    for (const pool of samplePools) {
      try {
        await registry.refreshPoolReserves([pool.poolId]);
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay between requests
      } catch (error) {
        logger.debug({ poolId: pool.poolId }, 'Skipped pool refresh (rate limit)');
      }
    }
    
    // Check prices on both DEXes
    const priceComparisons: Array<{
      pair: string;
      cetusPrice: number | null;
      turbosPrice: number | null;
      spread: number | null;
    }> = [];
    
    for (let i = 0; i < Math.min(5, commonTokens.length); i++) {
      const tokenA = commonTokens[i];
      if (!tokenA || tokenA === SUI_TYPE) continue;
      
      const cetusPrice = registry.getPrice(SUI_TYPE, tokenA, 'cetus');
      const turbosPrice = registry.getPrice(SUI_TYPE, tokenA, 'turbos');
      
      if (cetusPrice && turbosPrice) {
        const spread = Math.abs(turbosPrice - cetusPrice) / cetusPrice * 100;
        
        const tokenName = tokenA.split('::').pop()?.substring(0, 10) || 'Unknown';
        
        logger.info(`[${timestamp}] SUI/${tokenName}:`);
        logger.info(`  💧 Cetus:  ${cetusPrice.toFixed(6)}`);
        logger.info(`  🌊 Turbos: ${turbosPrice.toFixed(6)}`);
        logger.info(`  📊 Spread: ${spread.toFixed(2)}%`);
        
        priceComparisons.push({
          pair: `SUI/${tokenName}`,
          cetusPrice,
          turbosPrice,
          spread,
        });
        
        // Check for arbitrage opportunity
        if (spread > 1.0) {
          const buyDex = cetusPrice < turbosPrice ? 'Cetus' : 'Turbos';
          const sellDex = cetusPrice < turbosPrice ? 'Turbos' : 'Cetus';
          const profit = spread;
          
          logger.warn(`[${timestamp}] 💰 ARBITRAGE DETECTED!`);
          logger.warn(`  Pair: SUI/${tokenName}`);
          logger.warn(`  Profit: ${profit.toFixed(2)}%`);
          logger.warn(`  Route: Buy on ${buyDex} -> Sell on ${sellDex}`);
        }
      }
    }
    
    // Summary
    if (priceComparisons.length > 0) {
      const maxSpread = Math.max(...priceComparisons.map(p => p.spread || 0));
      logger.info(`\n📊 Summary: Max spread = ${maxSpread.toFixed(2)}%`);
    }
    
    // Rate limiter status
    const rateLimiterStatus = suiClient.getRateLimiterStatus();
    if (rateLimiterStatus) {
      logger.debug({ 
        tokensAvailable: rateLimiterStatus.tokens,
        queueLength: rateLimiterStatus.queueLength 
      }, '⚡ Rate limiter status');
    }
    
    // Wait 1 second before next iteration
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

monitorPrices().catch(error => {
  logger.error({ error }, '❌ Monitor crashed');
  process.exit(1);
});
