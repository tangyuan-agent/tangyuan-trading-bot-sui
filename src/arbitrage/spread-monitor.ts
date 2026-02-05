import { SuiClient } from '@mysten/sui/client';
import { PoolRegistry } from '../dex/pool-registry.js';
import { PriceMonitor } from '../price/monitor.js';
import { ArbitragePair, ArbitrageOpportunity, MonitorConfig } from './types.js';
import { calculateSpread } from '../price/calculator.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

export class SpreadMonitor {
  private priceMonitor: PriceMonitor;
  private config: MonitorConfig;
  private pairs: ArbitragePair[] = [];
  private opportunities: ArbitrageOpportunity[] = [];
  private isRunning = false;
  private checkTimer?: NodeJS.Timeout;
  
  constructor(
    _client: SuiClient,
    _registry: PoolRegistry,
    priceMonitor: PriceMonitor,
    config: Partial<MonitorConfig> = {}
  ) {
    this.priceMonitor = priceMonitor;
    this.config = {
      minSpread: config.minSpread || 0.5,
      checkInterval: config.checkInterval || 30000, // 30 seconds
      historySize: config.historySize || 100,
      autoRefresh: config.autoRefresh !== false,
    };
  }
  
  /**
   * Load pairs to monitor
   */
  loadPairs(pairs: ArbitragePair[]): void {
    this.pairs = pairs;
    logger.info({ count: pairs.length }, 'Loaded pairs for monitoring');
  }
  
  /**
   * Start monitoring
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Monitor already running');
      return;
    }
    
    this.isRunning = true;
    logger.info('Starting spread monitor...');
    
    // Initial check
    await this.checkAllPairs();
    
    // Schedule periodic checks
    this.checkTimer = setInterval(async () => {
      await this.checkAllPairs();
    }, this.config.checkInterval);
  }
  
  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
    }
    this.isRunning = false;
    logger.info('Spread monitor stopped');
  }
  
  /**
   * Check all pairs for arbitrage opportunities
   */
  private async checkAllPairs(): Promise<void> {
    const startTime = Date.now();
    logger.info({ pairCount: this.pairs.length }, 'Checking all pairs...');
    
    let opportunitiesFound = 0;
    
    for (const pair of this.pairs) {
      try {
        const opportunity = await this.checkPair(pair);
        
        if (opportunity) {
          this.opportunities.push(opportunity);
          opportunitiesFound++;
          
          // Trim history
          if (this.opportunities.length > this.config.historySize) {
            this.opportunities = this.opportunities.slice(-this.config.historySize);
          }
          
          // Log significant opportunities
          if (opportunity.spreadPercent >= this.config.minSpread) {
            logger.info({
              baseToken: this.shortenToken(pair.baseToken),
              quoteToken: this.shortenToken(pair.quoteToken),
              spread: `${opportunity.spreadPercent.toFixed(2)}%`,
              buyDex: opportunity.buyDex,
              sellDex: opportunity.sellDex,
            }, '🎯 Arbitrage opportunity');
          }
        }
        
        // Update pair's last check time
        pair.lastCheck = Date.now();
        
      } catch (error) {
        logger.debug({ error, pair: this.shortenToken(pair.baseToken) }, 'Failed to check pair');
      }
    }
    
    const elapsed = Date.now() - startTime;
    logger.info({
      checked: this.pairs.length,
      opportunitiesFound,
      elapsed: `${elapsed}ms`,
    }, 'Pair check complete');
  }
  
  /**
   * Check a single pair
   */
  private async checkPair(pair: ArbitragePair): Promise<ArbitrageOpportunity | null> {
    // Refresh reserves if needed
    if (this.config.autoRefresh) {
      await Promise.all(
        pair.pools.map(p => this.priceMonitor.updatePoolReserves(p.poolId))
      );
    }
    
    // Get prices from each DEX
    const prices = await this.priceMonitor.getPrices(
      pair.baseToken,
      pair.quoteToken,
      false // Don't refresh again
    );
    
    if (prices.length < 2) {
      return null; // Need at least 2 prices to compare
    }
    
    // Sort by price
    const sortedPrices = [...prices].sort((a, b) => a.price - b.price);
    const bestBuy = sortedPrices[0];
    const bestSell = sortedPrices[sortedPrices.length - 1];
    
    const spreadPercent = calculateSpread(bestBuy.price, bestSell.price);
    
    // Update pair spread
    pair.spreadPercent = spreadPercent;
    
    // Only return if spread meets minimum threshold
    if (spreadPercent < this.config.minSpread) {
      return null;
    }
    
    return {
      pair,
      buyDex: bestBuy.dex,
      buyPrice: bestBuy.price,
      sellDex: bestSell.dex,
      sellPrice: bestSell.price,
      spreadPercent,
      timestamp: Date.now(),
    };
  }
  
  /**
   * Get current opportunities
   */
  getOpportunities(minSpread?: number): ArbitrageOpportunity[] {
    const threshold = minSpread || this.config.minSpread;
    return this.opportunities.filter(opp => opp.spreadPercent >= threshold);
  }
  
  /**
   * Get top opportunities by spread
   */
  getTopOpportunities(count: number = 10): ArbitrageOpportunity[] {
    return [...this.opportunities]
      .sort((a, b) => b.spreadPercent - a.spreadPercent)
      .slice(0, count);
  }
  
  /**
   * Save opportunities to file
   */
  async saveOpportunities(filepath: string): Promise<void> {
    const data = {
      timestamp: Date.now(),
      config: this.config,
      pairs: this.pairs.length,
      opportunities: this.opportunities.map(opp => ({
        baseToken: this.shortenToken(opp.pair.baseToken),
        quoteToken: this.shortenToken(opp.pair.quoteToken),
        buyDex: opp.buyDex,
        buyPrice: opp.buyPrice,
        sellDex: opp.sellDex,
        sellPrice: opp.sellPrice,
        spread: `${opp.spreadPercent.toFixed(2)}%`,
        timestamp: new Date(opp.timestamp).toISOString(),
      })),
    };
    
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    logger.info({ filepath, count: data.opportunities.length }, 'Opportunities saved');
  }
  
  /**
   * Get monitoring statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      pairsMonitored: this.pairs.length,
      totalOpportunities: this.opportunities.length,
      recentOpportunities: this.opportunities.filter(
        opp => Date.now() - opp.timestamp < 60000 // Last minute
      ).length,
      config: this.config,
    };
  }
  
  private shortenToken(token: string): string {
    const parts = token.split('::');
    return parts.length >= 3 ? parts[parts.length - 1] : token.substring(0, 10);
  }
}
