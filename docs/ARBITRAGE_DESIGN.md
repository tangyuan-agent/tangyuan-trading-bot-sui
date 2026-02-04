# Arbitrage Bot - Technical Design

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Telegram Bot                      │
│            (Commands & Notifications)               │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│              Arbitrage Engine                       │
│  ┌─────────────────────────────────────────────┐   │
│  │  Price Monitor (1s polling)                 │   │
│  │    ├─ Cetus pools                           │   │
│  │    └─ Turbos pools                          │   │
│  └─────────────────┬───────────────────────────┘   │
│                    │                                │
│  ┌─────────────────▼───────────────────────────┐   │
│  │  Opportunity Finder                         │   │
│  │    ├─ Cross-DEX arbitrage detector          │   │
│  │    └─ Cyclic arbitrage path finder (4 hops) │   │
│  └─────────────────┬───────────────────────────┘   │
│                    │                                │
│  ┌─────────────────▼───────────────────────────┐   │
│  │  Profitability Calculator                   │   │
│  │    ├─ Estimate profit (after gas/slippage)  │   │
│  │    └─ Filter by 1% threshold                │   │
│  └─────────────────┬───────────────────────────┘   │
│                    │                                │
│  ┌─────────────────▼───────────────────────────┐   │
│  │  Execution Engine                           │   │
│  │    ├─ Build TransactionBlock                │   │
│  │    ├─ Apply slippage protection (0.5%)      │   │
│  │    └─ Sign & execute                        │   │
│  └─────────────────┬───────────────────────────┘   │
└────────────────────┼───────────────────────────────┘
                     │
┌────────────────────▼───────────────────────────────┐
│  Capital Manager                                   │
│    ├─ Track balances (SUI/USDC/WETH/...)          │
│    ├─ Enforce 10% per-trade limit                 │
│    └─ Auto-rebalance when needed                  │
└────────────────────────────────────────────────────┘
```

---

## 1. Price Monitoring

### Pool Discovery

**Initial Setup:**
1. Query Cetus for all active pools
2. Query Turbos for all active pools
3. Build token graph (nodes = tokens, edges = pools)

**Data Structure:**
```typescript
interface Pool {
  dex: 'cetus' | 'turbos';
  poolId: string;
  coinTypeX: string;
  coinTypeY: string;
  reserveX: bigint;
  reserveY: bigint;
  lastUpdated: number;
}

class PoolRegistry {
  private pools: Map<string, Pool> = new Map();
  
  async refresh(): Promise<void> {
    // Poll all pools from both DEXes
    const cetusPools = await this.fetchCetusPools();
    const turbosPools = await this.fetchTurbosPools();
    
    for (const pool of [...cetusPools, ...turbosPools]) {
      this.pools.set(pool.poolId, pool);
    }
  }
  
  getPrice(coinA: string, coinB: string, dex: string): number {
    const pool = this.findPool(coinA, coinB, dex);
    if (!pool) return 0;
    
    return Number(pool.reserveY) / Number(pool.reserveX);
  }
}
```

### Polling Strategy

**Frequency**: 1 second (configurable)

```typescript
class PriceMonitor {
  private pollInterval = 1000; // 1s
  
  async start(): Promise<void> {
    setInterval(async () => {
      await this.registry.refresh();
      await this.findOpportunities();
    }, this.pollInterval);
  }
}
```

**RPC Cost Optimization** (future):
- Cache pools with low activity
- Use batch requests
- Implement incremental updates

---

## 2. Cross-DEX Arbitrage Detection

### Strategy

**Example Opportunity:**
```
Cetus: 1 SUI = 1.98 USDC (buy SUI cheap)
Turbos: 1 SUI = 2.02 USDC (sell SUI expensive)

Trade:
1. Buy 100 SUI on Cetus for 198 USDC
2. Sell 100 SUI on Turbos for 202 USDC
3. Profit: 4 USDC (2% before gas)
```

### Implementation

```typescript
class CrossDEXDetector {
  async findOpportunities(): Promise<ArbitrageOp[]> {
    const opportunities: ArbitrageOp[] = [];
    
    // Get all unique token pairs
    const pairs = this.registry.getAllPairs();
    
    for (const [tokenA, tokenB] of pairs) {
      const cetusPriceAB = this.registry.getPrice(tokenA, tokenB, 'cetus');
      const turbosPriceAB = this.registry.getPrice(tokenA, tokenB, 'turbos');
      
      if (!cetusPriceAB || !turbosPriceAB) continue;
      
      // Check if Cetus is cheaper (buy there, sell on Turbos)
      const spreadPercent = (turbosPriceAB - cetusPriceAB) / cetusPriceAB;
      
      if (spreadPercent > 0.01) { // > 1% spread
        opportunities.push({
          type: 'cross-dex',
          buyDex: 'cetus',
          sellDex: 'turbos',
          tokenIn: tokenA,
          tokenOut: tokenB,
          spreadPercent,
        });
      }
      
      // Check reverse direction
      const spreadPercentReverse = (cetusPriceAB - turbosPriceAB) / turbosPriceAB;
      
      if (spreadPercentReverse > 0.01) {
        opportunities.push({
          type: 'cross-dex',
          buyDex: 'turbos',
          sellDex: 'cetus',
          tokenIn: tokenA,
          tokenOut: tokenB,
          spreadPercent: spreadPercentReverse,
        });
      }
    }
    
    return opportunities;
  }
}
```

---

## 3. Cyclic Arbitrage Path Discovery

### Graph-Based Algorithm

**Graph Representation:**
```
Nodes: Tokens (SUI, USDC, WETH, ...)
Edges: Pools (with exchange rates)

Example:
SUI ---(1.98 USDC/SUI)---> USDC
USDC ---(0.0005 WETH/USDC)---> WETH
WETH ---(2100 SUI/WETH)---> SUI

Path: SUI → USDC → WETH → SUI
Net: 1 SUI → 1.98 USDC → 0.00099 WETH → 2.079 SUI
Profit: 1.079 SUI (7.9%)
```

### Implementation (DFS with Memoization)

```typescript
class CyclicArbitrageFinder {
  private maxHops = 4;
  
  async findCycles(startToken: string): Promise<ArbitragePath[]> {
    const paths: ArbitragePath[] = [];
    const visited = new Set<string>();
    
    const dfs = (
      currentToken: string,
      path: string[],
      amountIn: number,
      depth: number
    ) => {
      if (depth > this.maxHops) return;
      
      // Check if we've returned to start with profit
      if (depth > 2 && currentToken === startToken) {
        const profitPercent = (amountIn - 1) * 100;
        if (profitPercent > 1) { // > 1% profit
          paths.push({
            type: 'cyclic',
            path: [...path],
            profitPercent,
          });
        }
        return;
      }
      
      // Explore neighbors
      const neighbors = this.registry.getNeighbors(currentToken);
      
      for (const [nextToken, pool] of neighbors) {
        if (depth > 0 && visited.has(nextToken)) continue;
        
        const price = this.registry.getPrice(currentToken, nextToken, pool.dex);
        const amountOut = amountIn * price;
        
        visited.add(currentToken);
        path.push(nextToken);
        
        dfs(nextToken, path, amountOut, depth + 1);
        
        path.pop();
        visited.delete(currentToken);
      }
    };
    
    dfs(startToken, [startToken], 1, 0);
    return paths;
  }
  
  async findAllCycles(): Promise<ArbitragePath[]> {
    const allPaths: ArbitragePath[] = [];
    const tokens = this.registry.getAllTokens();
    
    for (const token of tokens) {
      const paths = await this.findCycles(token);
      allPaths.push(...paths);
    }
    
    // Deduplicate and sort by profit
    return this.deduplicateAndSort(allPaths);
  }
}
```

**Optimization:**
- Limit search to tokens with sufficient liquidity
- Use BFS for shorter paths first
- Cache computed paths for recurring patterns

---

## 4. Profitability Calculation

### Gas Estimation

```typescript
async function estimateArbitrageGas(op: ArbitrageOp): Promise<bigint> {
  if (op.type === 'cross-dex') {
    // Two separate transactions
    return 2n * 1_000_000n; // ~0.002 SUI total
  } else {
    // Single transaction with multiple swaps
    const swapCount = op.path.length - 1;
    return BigInt(swapCount) * 500_000n; // ~0.0005 SUI per swap
  }
}
```

### Net Profit Calculation

```typescript
interface ProfitEstimate {
  grossProfit: number;      // Before costs
  gasCost: number;          // In USD
  slippageCost: number;     // Estimated
  netProfit: number;        // After all costs
  netProfitPercent: number; // ROI
}

async function calculateProfit(
  op: ArbitrageOp,
  amountIn: number
): Promise<ProfitEstimate> {
  // Simulate execution with current prices
  let amountOut = amountIn;
  
  for (const swap of op.swaps) {
    const price = registry.getPrice(swap.tokenIn, swap.tokenOut, swap.dex);
    amountOut *= price;
    
    // Apply estimated slippage (0.1% per swap)
    amountOut *= 0.999;
  }
  
  const grossProfit = amountOut - amountIn;
  const gasCost = await estimateArbitrageGas(op);
  const gasCostUSD = Number(gasCost) * suiPriceUSD / 1e9;
  
  // Slippage cost already accounted in amountOut
  const netProfit = grossProfit - gasCostUSD;
  const netProfitPercent = (netProfit / amountIn) * 100;
  
  return {
    grossProfit,
    gasCost: gasCostUSD,
    slippageCost: amountIn * 0.001 * op.swaps.length,
    netProfit,
    netProfitPercent,
  };
}
```

### Threshold Filter

```typescript
class OpportunityFilter {
  private minProfitPercent = 1.0; // 1%
  
  async filter(ops: ArbitrageOp[]): Promise<ArbitrageOp[]> {
    const profitable: ArbitrageOp[] = [];
    
    for (const op of ops) {
      const estimate = await calculateProfit(op, this.tradeSize);
      
      if (estimate.netProfitPercent >= this.minProfitPercent) {
        op.profitEstimate = estimate;
        profitable.push(op);
      }
    }
    
    // Sort by net profit (descending)
    return profitable.sort((a, b) => 
      b.profitEstimate.netProfit - a.profitEstimate.netProfit
    );
  }
}
```

---

## 5. Execution Engine

### Cross-DEX Execution

```typescript
async function executeCrossDEX(op: CrossDEXOp): Promise<void> {
  const { buyDex, sellDex, tokenIn, tokenOut, amountIn } = op;
  
  // Transaction 1: Buy on cheaper DEX
  const buyTx = new TransactionBlock();
  const [coinOut] = buildSwapCall(buyTx, buyDex, tokenIn, tokenOut, amountIn);
  
  const buyResult = await client.signAndExecuteTransactionBlock({
    transactionBlock: buyTx,
    signer: keypair,
  });
  
  if (buyResult.effects.status.status !== 'success') {
    throw new Error('Buy transaction failed');
  }
  
  // Transaction 2: Sell on expensive DEX
  const sellTx = new TransactionBlock();
  buildSwapCall(sellTx, sellDex, tokenOut, tokenIn, coinOut.amount);
  
  const sellResult = await client.signAndExecuteTransactionBlock({
    transactionBlock: sellTx,
    signer: keypair,
  });
  
  // Log result
  await db.logArbitrage({
    type: 'cross-dex',
    buyDigest: buyResult.digest,
    sellDigest: sellResult.digest,
    profit: calculateActualProfit(buyResult, sellResult),
  });
}
```

### Cyclic Execution (Atomic)

```typescript
async function executeCyclic(op: CyclicOp): Promise<void> {
  const tx = new TransactionBlock();
  
  let currentCoin = tx.gas; // Start with SUI
  
  for (let i = 0; i < op.path.length - 1; i++) {
    const tokenIn = op.path[i];
    const tokenOut = op.path[i + 1];
    const dex = op.dexes[i];
    
    [currentCoin] = buildSwapCall(tx, dex, tokenIn, tokenOut, currentCoin);
  }
  
  // Final coin should be more than initial
  // TransactionBlock will revert if profit check fails
  
  const result = await client.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    signer: keypair,
  });
  
  await db.logArbitrage({
    type: 'cyclic',
    digest: result.digest,
    path: op.path,
    profit: extractProfitFromResult(result),
  });
}
```

### Slippage Protection

```typescript
function buildSwapCall(
  tx: TransactionBlock,
  dex: string,
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint
): [coinOut, amountOut] {
  const expectedOut = estimateOutput(tokenIn, tokenOut, amountIn, dex);
  const minOut = expectedOut * 995n / 1000n; // 0.5% slippage tolerance
  
  const [coinOut] = tx.moveCall({
    target: `${getDexPackage(dex)}::router::swap`,
    arguments: [
      tx.object(getPoolId(tokenIn, tokenOut, dex)),
      tx.pure(amountIn),
      tx.pure(minOut), // Minimum output (slippage protection)
    ],
    typeArguments: [tokenIn, tokenOut],
  });
  
  return coinOut;
}
```

---

## 6. Capital Management

### Initial Allocation

```
Total: $1,000
- 40% SUI ($400)
- 40% USDC ($400)
- 10% WETH ($100)
- 10% Other ($100)
```

### Per-Trade Limit

```typescript
class CapitalManager {
  private totalCapitalUSD = 1000;
  private perTradeLimitPercent = 0.1; // 10%
  
  getMaxTradeSize(token: string): number {
    const balance = this.balances.get(token);
    const maxUSD = this.totalCapitalUSD * this.perTradeLimitPercent;
    
    return Math.min(balance.usd, maxUSD);
  }
  
  async rebalance(): Promise<void> {
    // Check if distribution is skewed
    const balances = await this.fetchBalances();
    
    for (const [token, balance] of balances) {
      const targetPercent = this.targetAllocation.get(token);
      const currentPercent = balance.usd / this.totalCapitalUSD;
      
      if (Math.abs(currentPercent - targetPercent) > 0.1) {
        // Rebalance by swapping
        await this.executeRebalanceTrade(token, targetPercent);
      }
    }
  }
}
```

---

## 7. Risk Management

### Circuit Breaker

```typescript
class RiskManager {
  private consecutiveFailures = 0;
  private dailyLoss = 0;
  
  async validateTrade(op: ArbitrageOp): Promise<void> {
    // Check circuit breaker
    if (this.consecutiveFailures >= 5) {
      throw new Error('Circuit breaker triggered');
    }
    
    // Check daily loss limit
    if (this.dailyLoss > 200) { // $200
      throw new Error('Daily loss limit exceeded');
    }
    
    // Check single trade limit
    if (op.amountIn > 100) {
      throw new Error('Single trade limit exceeded');
    }
  }
  
  recordSuccess(): void {
    this.consecutiveFailures = 0;
  }
  
  recordFailure(loss: number): void {
    this.consecutiveFailures++;
    this.dailyLoss += loss;
  }
}
```

---

## Performance Targets

- **Opportunity Detection**: < 100ms per scan cycle
- **Execution Latency**: < 3s (from detection to on-chain confirmation)
- **Memory Usage**: < 500MB
- **Accuracy**: 95%+ profitable trades

---

Last updated: 2026-02-04
