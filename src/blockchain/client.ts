import { SuiClient, SuiHTTPTransport } from '@mysten/sui/client';
import { SuiNetwork } from '../types/index.js';
import { RateLimiter } from '../utils/rate-limiter.js';
import logger from '../utils/logger.js';

export class SuiClientManager {
  private client: SuiClient;
  private currentRpcIndex = 0;
  private rpcUrls: string[];
  private rateLimiter?: RateLimiter;
  
  constructor(network: SuiNetwork, rpcUrls: string[], rateLimit?: number) {
    this.rpcUrls = rpcUrls;
    
    if (rateLimit) {
      this.rateLimiter = new RateLimiter(rateLimit);
    }
    
    if (rpcUrls.length === 0) {
      throw new Error('At least one RPC URL is required');
    }
    
    this.client = this.createClient(rpcUrls[0]);
    logger.info({ network, rpc: rpcUrls[0] }, 'SuiClient initialized');
  }
  
  private createClient(rpcUrl: string): SuiClient {
    return new SuiClient({
      transport: new SuiHTTPTransport({
        url: rpcUrl,
      }),
    });
  }
  
  getClient(): SuiClient {
    return this.client;
  }
  
  async testConnection(): Promise<boolean> {
    try {
      const chainId = await this.client.getChainIdentifier();
      logger.info({ chainId }, 'Connection test successful');
      return true;
    } catch (error) {
      logger.error({ error }, 'Connection test failed');
      return false;
    }
  }
  
  async switchToFallback(): Promise<void> {
    this.currentRpcIndex = (this.currentRpcIndex + 1) % this.rpcUrls.length;
    const newRpcUrl = this.rpcUrls[this.currentRpcIndex];
    
    logger.warn({ newRpc: newRpcUrl }, 'Switching to fallback RPC');
    this.client = this.createClient(newRpcUrl);
    
    const success = await this.testConnection();
    if (!success && this.rpcUrls.length > 1) {
      await this.switchToFallback();
    }
  }
  
  async withRetry<T>(
    operation: (client: SuiClient) => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Apply rate limiting if configured
        if (this.rateLimiter) {
          return await this.rateLimiter.executeWithLimit(() => operation(this.client));
        } else {
          return await operation(this.client);
        }
      } catch (error) {
        lastError = error as Error;
        logger.warn(
          { attempt: attempt + 1, maxRetries, error },
          'Operation failed, retrying...'
        );
        
        if (attempt < maxRetries - 1) {
          await this.switchToFallback();
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }
    
    throw lastError;
  }
  
  getRateLimiterStatus() {
    return this.rateLimiter?.getStatus();
  }
}

export function createSuiClient(
  network: SuiNetwork,
  rpcUrls: string[],
  rateLimit?: number
): SuiClientManager {
  return new SuiClientManager(network, rpcUrls, rateLimit);
}
