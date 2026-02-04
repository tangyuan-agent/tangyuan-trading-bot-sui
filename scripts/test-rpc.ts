import { config } from 'dotenv';
import { createSuiClient } from '../src/blockchain/client.js';
import logger from '../src/utils/logger.js';

config();

async function testRPC() {
  logger.info('Testing QuickNode mainnet RPC...');
  
  const mainnetRpc = process.env.SUI_MAINNET_RPC;
  if (!mainnetRpc) {
    logger.error('SUI_MAINNET_RPC not set');
    process.exit(1);
  }
  
  const client = createSuiClient('mainnet', [mainnetRpc]);
  
  // Test 1: Connection test
  logger.info('Test 1: Connection test');
  const connected = await client.testConnection();
  if (!connected) {
    logger.error('Connection failed');
    process.exit(1);
  }
  
  // Test 2: Get latest checkpoint
  logger.info('Test 2: Get latest checkpoint');
  const suiClient = client.getClient();
  const checkpoint = await suiClient.getLatestCheckpointSequenceNumber();
  logger.info({ checkpoint }, 'Latest checkpoint');
  
  // Test 3: Get total supply
  logger.info('Test 3: Get SUI total supply');
  const totalSupply = await suiClient.getTotalSupply({ coinType: '0x2::sui::SUI' });
  logger.info({ totalSupply: totalSupply.value }, 'SUI total supply');
  
  // Test 4: Check rate limit (make 20 requests in 1 second)
  logger.info('Test 4: Rate limit test (15 req/s)');
  const startTime = Date.now();
  const promises = [];
  
  for (let i = 0; i < 20; i++) {
    promises.push(
      suiClient.getLatestCheckpointSequenceNumber().catch(err => {
        logger.warn({ error: err.message, requestNumber: i + 1 }, 'Request failed (rate limit?)');
        return null;
      })
    );
  }
  
  const results = await Promise.all(promises);
  const successCount = results.filter(r => r !== null).length;
  const duration = Date.now() - startTime;
  
  logger.info(
    { 
      successCount, 
      failCount: 20 - successCount, 
      duration: `${duration}ms`,
      rps: (successCount / (duration / 1000)).toFixed(2)
    },
    'Rate limit test results'
  );
  
  logger.info('✅ All tests passed!');
}

testRPC().catch(error => {
  logger.error({ error }, 'Test failed');
  process.exit(1);
});
