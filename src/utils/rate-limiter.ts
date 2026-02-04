import logger from './logger.js';

export class RateLimiter {
  private queue: Array<() => void> = [];
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second
  private lastRefill: number;
  private processing = false;
  
  constructor(requestsPerSecond: number) {
    this.maxTokens = requestsPerSecond;
    this.tokens = requestsPerSecond;
    this.refillRate = requestsPerSecond;
    this.lastRefill = Date.now();
    
    logger.info(
      { maxRps: requestsPerSecond },
      'RateLimiter initialized'
    );
  }
  
  private refillTokens(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
  
  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this.processQueue();
    });
  }
  
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    
    while (this.queue.length > 0) {
      this.refillTokens();
      
      if (this.tokens >= 1) {
        this.tokens -= 1;
        const resolve = this.queue.shift();
        if (resolve) resolve();
        
        // Add small delay to smooth out burst requests
        if (this.queue.length > 0) {
          await new Promise(r => setTimeout(r, 10));
        }
      } else {
        // Wait until next token is available
        const waitTime = Math.max(10, (1 - this.tokens) / this.refillRate * 1000);
        await new Promise(r => setTimeout(r, waitTime));
      }
    }
    
    this.processing = false;
  }
  
  async executeWithLimit<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    return fn();
  }
  
  getStatus(): { tokens: number; queueLength: number } {
    this.refillTokens();
    return {
      tokens: Math.floor(this.tokens * 100) / 100,
      queueLength: this.queue.length,
    };
  }
}
