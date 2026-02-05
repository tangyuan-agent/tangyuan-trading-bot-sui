import { config } from 'dotenv';
import { createSuiClient } from '../src/blockchain/client.js';
import { PoolRegistry } from '../src/dex/pool-registry.js';
import { PriceMonitor } from '../src/price/monitor.js';
import { formatPrice, formatSpread, shortenCoinType } from '../src/price/calculator.js';
import logger from '../src/utils/logger.js';

config();

// Common Sui tokens (from the pools we discovered)
const SUI = '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI';
const USDC = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';

async function testPriceMonitor() {
  logger.info('Testing price monitor...');
  
  const rateLimit = Number(process.env.SUI_MAINNET_RATE_LIMIT) || 12;
  const mainnetRpc = process.env.SUI_MAINNET_RPC;
  
  if (!mainnetRpc) {
    logger.error('SUI_MAINNET_RPC not set');
    process.exit(1);
  }
  
  // Create Sui client
  const suiClient = createSuiClient('mainnet', [mainnetRpc], rateLimit);
  const client = suiClient.getClient();
  
  // Create pool registry
  const registry = new PoolRegistry(client);
  
  try {
    // Initialize registry
    logger.info('Initializing pool registry...');
    await registry.initialize(['cetus', 'turbos']);
    
    // Create price monitor
    const priceMonitor = new PriceMonitor(client, registry);
    
    // Test 1: Get all available pairs
    logger.info('Test 1: Getting all available trading pairs...');
    const allPairs = priceMonitor.getAllPairs();
    logger.info({ totalPairs: allPairs.length }, 'Available trading pairs');
    
    // Show some example pairs
    logger.info('Sample pairs:');
    allPairs.slice(0, 5).forEach(pair => {
      logger.info({
        base: shortenCoinType(pair.baseToken),
        quote: shortenCoinType(pair.quoteToken),
      });
    });
    
    // Test 2: Get prices for a specific pair (if it exists)
    logger.info('\nTest 2: Getting prices for token pairs...');
    
    // Try to find a pair with SUI
    const suiPairs = allPairs.filter(p => 
      p.baseToken === SUI || p.quoteToken === SUI
    );
    
    const pair = suiPairs.length > 0 ? suiPairs[0] : allPairs[0];
    
    logger.info({
      base: shortenCoinType(pair.baseToken),
      quote: shortenCoinType(pair.quoteToken),
    }, 'Testing pair');
    
    const prices = await priceMonitor.getPrices(pair.baseToken, pair.quoteToken, true); // refresh=true
    
    logger.info({ priceCount: prices.length }, 'Prices found');
    
    prices.forEach(p => {
      logger.info({
        dex: p.dex,
        price: formatPrice(p.price),
        reserveBase: p.reserveBase.toString(),
        reserveQuote: p.reserveQuote.toString(),
      });
    });
    
    // Test 3: Find arbitrage opportunities
    logger.info('\nTest 3: Finding arbitrage opportunities...');
    const opportunities = await priceMonitor.findArbitrageOpportunities(0.1, true); // 0.1% minimum spread, refresh=true
    
    logger.info({ opportunityCount: opportunities.length }, 'Arbitrage opportunities found');
    
    // Show top 5 opportunities
    opportunities.slice(0, 5).forEach((opp, index) => {
      logger.info(`\n=== Opportunity #${index + 1} ===`);
      logger.info({
        base: shortenCoinType(opp.baseToken),
        quote: shortenCoinType(opp.quoteToken),
        spread: formatSpread(opp.spreadPercent),
      });
      logger.info({
        buyOn: opp.bestBuy.dex,
        buyPrice: formatPrice(opp.bestBuy.price),
        sellOn: opp.bestSell.dex,
        sellPrice: formatPrice(opp.bestSell.price),
      }, 'Best prices');
    });
    
    // Test 4: Compare prices for a pair
    if (opportunities.length > 0) {
      const opp = opportunities[0];
      logger.info('\nTest 4: Detailed price comparison...');
      const comparison = await priceMonitor.comparePrices(opp.baseToken, opp.quoteToken, true);
      
      if (comparison) {
        logger.info({
          base: shortenCoinType(comparison.baseToken),
          quote: shortenCoinType(comparison.quoteToken),
          priceCount: comparison.prices.length,
          spread: formatSpread(comparison.spreadPercent),
        }, 'Price comparison');
        
        console.log('\nAll prices (sorted):');
        comparison.prices.forEach(p => {
          console.log(`  ${p.dex.padEnd(10)} ${formatPrice(p.price).padStart(15)}`);
        });
      }
    }
    
    logger.info('\n✅ Price monitor test complete!');
    
  } catch (error) {
    logger.error({ error }, 'Price monitor test failed');
    process.exit(1);
  }
}

testPriceMonitor().catch(error => {
  logger.error({ error }, 'Fatal error');
  process.exit(1);
});
