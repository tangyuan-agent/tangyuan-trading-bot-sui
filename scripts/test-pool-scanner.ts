import { config } from 'dotenv';
import { createSuiClient } from '../src/blockchain/client.js';
import { PoolRegistry } from '../src/dex/pool-registry.js';
import logger from '../src/utils/logger.js';

config();

async function testPoolScanner() {
  logger.info('Testing pool scanner...');
  
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
    // Initialize registry (fetch all pools)
    logger.info('Fetching pools from DEXes...');
    await registry.initialize(['cetus', 'turbos']);
    
    // Get statistics
    const allPools = registry.getAllPools();
    const cetusPools = registry.getPoolsByDex('cetus');
    const turbosPools = registry.getPoolsByDex('turbos');
    const allTokens = registry.getAllTokens();
    
    logger.info(
      {
        totalPools: allPools.length,
        cetusPools: cetusPools.length,
        turbosPools: turbosPools.length,
        uniqueTokens: allTokens.length,
      },
      'Pool scanner results'
    );
    
    // Show sample pools
    logger.info('Sample pools:');
    allPools.slice(0, 5).forEach(pool => {
      logger.info({
        dex: pool.dex,
        poolId: pool.poolId.substring(0, 20) + '...',
        coinA: pool.coinTypeA.substring(0, 30) + '...',
        coinB: pool.coinTypeB.substring(0, 30) + '...',
        feeRate: pool.feeRate,
      });
    });
    
    // Test token graph
    logger.info('Testing token graph...');
    const graph = registry.getTokenGraph();
    
    // Find a token with most connections
    let maxConnections = 0;
    let mostConnectedToken = '';
    
    for (const [token, node] of graph.nodes.entries()) {
      const connections = node.neighbors.size;
      if (connections > maxConnections) {
        maxConnections = connections;
        mostConnectedToken = token;
      }
    }
    
    if (mostConnectedToken) {
      logger.info({
        token: mostConnectedToken.substring(0, 50) + '...',
        connections: maxConnections,
      }, 'Most connected token');
      
      const neighbors = registry.getNeighbors(mostConnectedToken);
      logger.info({ neighborCount: neighbors.size }, 'Neighbors');
    }
    
    logger.info('✅ Pool scanner test complete!');
    
  } catch (error) {
    logger.error({ error }, 'Pool scanner test failed');
    
    // If error is due to missing contract addresses, show helpful message
    if (error instanceof Error && error.message.includes('MoveEventType')) {
      logger.info('ℹ️  This error is expected - need to update DEX contract addresses');
      logger.info('   Check src/dex/adapters/cetus.ts and turbos.ts');
      logger.info('   Update CETUS_CONFIG and TURBOS_CONFIG with real mainnet addresses');
    }
    
    process.exit(1);
  }
}

testPoolScanner().catch(error => {
  logger.error({ error }, 'Fatal error');
  process.exit(1);
});
