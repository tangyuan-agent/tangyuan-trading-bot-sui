import { config } from 'dotenv';
import { createSuiClient } from './blockchain/client.js';
import { createWallet } from './blockchain/wallet.js';
import logger from './utils/logger.js';
import type { SuiNetwork } from './types/index.js';

config();

async function main() {
  logger.info('Starting Tangyuan Arbitrage Bot...');
  
  // Initialize Sui client
  const network = (process.env.SUI_NETWORK || 'devnet') as SuiNetwork;
  const rpcUrl = process.env.SUI_RPC_URL || 'https://fullnode.devnet.sui.io:443';
  const rpcFallback = process.env.SUI_RPC_FALLBACK;
  
  const rpcUrls = [rpcUrl];
  if (rpcFallback) {
    rpcUrls.push(rpcFallback);
  }
  
  logger.info({ network, rpcUrls }, 'Initializing Sui client...');
  const suiClient = createSuiClient(network, rpcUrls);
  
  // Test connection
  const connected = await suiClient.testConnection();
  if (!connected) {
    logger.error('Failed to connect to Sui network');
    process.exit(1);
  }
  
  // Initialize wallet
  logger.info('Loading wallet...');
  const wallet = createWallet();
  
  const privateKey = process.env.PRIVATE_KEY;
  const walletFile = process.env.WALLET_FILE;
  const walletPassword = process.env.WALLET_PASSWORD;
  
  if (privateKey) {
    wallet.loadFromPrivateKey(privateKey);
  } else if (walletFile && walletPassword) {
    await wallet.loadFromEncryptedFile(walletFile, walletPassword);
  } else {
    logger.error('No wallet credentials provided. Set PRIVATE_KEY or WALLET_FILE + WALLET_PASSWORD');
    process.exit(1);
  }
  
  const address = wallet.getAddress();
  logger.info({ address }, 'Wallet loaded successfully');
  
  // Query wallet balance
  const client = suiClient.getClient();
  const balance = await client.getBalance({
    owner: address,
  });
  
  logger.info(
    {
      address,
      balance: balance.totalBalance,
      coinType: balance.coinType,
    },
    'Wallet balance'
  );
  
  logger.info('Initialization complete! Bot is ready.');
  
  // TODO: Start arbitrage engine
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error');
  process.exit(1);
});
