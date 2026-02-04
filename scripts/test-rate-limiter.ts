import { config } from 'dotenv';
import { createSuiClient } from '../src/blockchain/client.js';
import logger from '../src/utils/logger.js';

config();

async function testRateLimiter() {
  const rateLimit = Number(process.env.SUI_MAINNET_RATE_LIMIT) || 12;
  
  logger.info(`Testing RateLimiter with QuickNode mainnet RPC (${rateLimit} req/s)...`);
  
  const mainnetRpc = process.env.SUI_MAINNET_RPC;
  if (!mainnetRpc) {
    logger.error('SUI_MAINNET_RPC not set');
    process.exit(1);
  }
  
  // Create client with rate limit
  const client = createSuiClient('mainnet', [mainnetRpc], rateLimit);
  const suiClient = client.getClient();
  
  // Test: Make 30 requests (should take ~2 seconds)
  logger.info('Making 30 requests with rate limiter...');
  
  const startTime = Date.now();
  const promises = [];
  
  for (let i = 0; i < 30; i++) {
    promises.push(
      client.withRetry(() => suiClient.getLatestCheckpointSequenceNumber()).then(() => {
        const elapsed = Date.now() - startTime;
        logger.debug({ requestNumber: i + 1, elapsed: `${elapsed}ms` }, 'Request completed');
        return true;
      })
    );
  }
  
  const results = await Promise.all(promises);
  const duration = Date.now() - startTime;
  const successCount = results.filter(r => r === true).length;
  
  const expectedDuration = Math.ceil(30 / rateLimit * 1000);
  
  logger.info(
    {
      totalRequests: 30,
      successCount,
      failCount: 30 - successCount,
      duration: `${duration}ms`,
      expectedDuration: `~${expectedDuration}ms`,
      actualRps: (successCount / (duration / 1000)).toFixed(2),
      targetRps: rateLimit,
    },
    'Rate limiter test results'
  );
  
  // Check rate limiter status
  const status = client.getRateLimiterStatus();
  logger.info({ status }, 'Rate limiter status');
  
  const minExpected = expectedDuration * 0.8;
  const maxExpected = expectedDuration * 1.5;
  
  if (successCount === 30 && duration >= minExpected && duration <= maxExpected) {
    logger.info('✅ Rate limiter working correctly!');
  } else {
    logger.warn('⚠️ Rate limiter may need adjustment');
  }
}

testRateLimiter().catch(error => {
  logger.error({ error }, 'Test failed');
  process.exit(1);
});
