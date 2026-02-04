# 汤圆交易机器人 (Sui) - 技术设计方案

## 📋 概览

本项目基于之前 EVM 版本的成功经验，针对 Sui 区块链重新设计。核心架构保持 90% 一致，仅在链交互层进行适配。

---

## 核心差异：EVM vs Sui

| 维度 | EVM 版本 | Sui 版本 |
|------|---------|---------|
| 区块链库 | ethers.js | @mysten/sui.js |
| 钱包类型 | ECDSA (secp256k1) | Ed25519 |
| 账户模型 | Account-based | Object-based (UTXO-like) |
| 交易构建 | Contract calls | TransactionBlock + Move calls |
| Gas 机制 | EIP-1559 (动态费用) | Fixed + storage rebate |
| DEX 协议 | Uniswap V2/V3 | Cetus / Turbos (AMM) |

---

## 1️⃣ 目标区块链

### Sui 主网

**选择理由：**
- ✅ **低 Gas**：~$0.001 per transaction
- ✅ **高速**：400ms 出块，2秒最终确认
- ✅ **竞争少**：MEV 工具不成熟，机会更多
- ✅ **并行执行**：Object-based 模型天然并行

**RPC 配置：**
```typescript
const RPC_URLS = {
  mainnet: [
    'https://fullnode.mainnet.sui.io:443',
    'https://sui-mainnet.nodeinfra.com',
    'https://mainnet.suiet.app'
  ],
  testnet: ['https://fullnode.testnet.sui.io:443'],
  devnet: ['https://fullnode.devnet.sui.io:443']
};
```

---

## 2️⃣ DEX 集成

### MVP: Cetus + Turbos

**Cetus Protocol**
- 主 DEX（TVL 最大）
- Concentrated liquidity AMM (类似 Uniswap V3)
- Package: `0x...` (待补充实际地址)
- 优先级：1

**Turbos Finance**
- 备用 DEX
- Concentrated liquidity AMM
- Package: `0x...`
- 优先级：2

**DEX Adapter 接口：**
```typescript
interface DEXAdapter {
  name: string;
  priority: number;
  
  // Get quote for swap
  getQuote(params: QuoteParams): Promise<Quote>;
  
  // Execute swap transaction
  buildSwapTx(params: SwapParams): TransactionBlock;
}

interface QuoteParams {
  coinTypeIn: string;   // e.g., '0x2::sui::SUI'
  coinTypeOut: string;
  amountIn: bigint;
}

interface Quote {
  amountOut: bigint;
  priceImpact: number;
  route: string[];
  estimatedGas: bigint;
}
```

**路由逻辑：**
1. 并行查询所有启用的 DEX
2. 计算净收益（amountOut - gas）
3. 选择最优 DEX
4. 执行交易

---

## 3️⃣ 钱包管理

### Ed25519 密钥对

**密钥生成：**
```typescript
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';

// Generate new keypair
const keypair = new Ed25519Keypair();

// Or import from mnemonic
const mnemonic = 'word1 word2 ... word12';
const keypair = Ed25519Keypair.deriveKeypair(mnemonic);
```

**加密存储：**
```typescript
// Encrypt keypair with password
const encrypted = await encryptKeypair(keypair, password);
await fs.writeFile('~/.tangyuan/wallet.json', encrypted, { mode: 0o600 });

// Decrypt on startup
const encrypted = await fs.readFile('~/.tangyuan/wallet.json');
const keypair = await decryptKeypair(encrypted, password);
```

**安全措施：**
- 文件权限 `600`（仅 owner 可读写）
- 使用 AES-256-GCM 加密
- 密码强度验证（最少 12 字符）
- 永不记录私钥到日志

---

## 4️⃣ 交易执行流程

### Sui TransactionBlock

```typescript
async function executeSwap(params: SwapParams): Promise<SuiTransactionBlockResponse> {
  const tx = new TransactionBlock();
  
  // 1. Get coin objects for input amount
  const [coin] = tx.splitCoins(tx.gas, [params.amountIn]);
  
  // 2. Call DEX swap function
  const [outputCoin] = tx.moveCall({
    target: `${CETUS_PACKAGE}::swap_router::swap_a_b`,
    arguments: [
      tx.object(POOL_ID),
      coin,
      tx.pure(params.minAmountOut),  // Slippage protection
    ],
    typeArguments: [params.coinTypeIn, params.coinTypeOut],
  });
  
  // 3. Transfer output to sender
  tx.transferObjects([outputCoin], tx.pure(sender));
  
  // 4. Set gas budget
  tx.setGasBudget(params.gasBudget || 10_000_000);
  
  // 5. Sign and execute
  const result = await client.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    signer: keypair,
    options: {
      showEffects: true,
      showObjectChanges: true,
    },
  });
  
  return result;
}
```

---

## 5️⃣ Gas 管理

### Sui Gas 模型

**Gas 计算：**
```
Total Gas = Computation Cost + Storage Cost - Storage Rebate
```

**Gas 预估策略：**
```typescript
async function estimateGas(tx: TransactionBlock): Promise<bigint> {
  // Dry run to get gas estimate
  const dryRun = await client.dryRunTransactionBlock({
    transactionBlock: await tx.build({ client }),
  });
  
  const gasUsed = BigInt(dryRun.effects.gasUsed.computationCost)
                + BigInt(dryRun.effects.gasUsed.storageCost)
                - BigInt(dryRun.effects.gasUsed.storageRebate);
  
  // Add 20% buffer
  return gasUsed * 120n / 100n;
}
```

**Gas 价格：**
- Sui 使用固定 gas price (1000 MIST)
- 无需动态调整（与 EVM 不同）
- 只需优化交易逻辑以减少 computation units

---

## 6️⃣ 策略实现

### DCA 策略（保持不变）

```typescript
class DCAStrategy {
  async execute(): Promise<void> {
    const config = this.config.dca;
    
    for (const pair of config.pairs) {
      // 1. Get best quote
      const quote = await this.dexRouter.getBestQuote({
        tokenIn: pair.tokenIn,
        tokenOut: pair.tokenOut,
        amountUSD: pair.amountUSD,
      });
      
      // 2. Check slippage
      if (quote.priceImpact > config.slippage) {
        logger.warn('Slippage too high, skipping');
        continue;
      }
      
      // 3. Execute swap
      const result = await this.dexRouter.executeSwap(quote);
      
      // 4. Log trade
      await this.db.logTrade({
        strategy: 'dca',
        ...result,
      });
      
      // 5. Notify user
      await this.bot.notify(`DCA executed: Bought ${result.amountOut} ${pair.tokenOut}`);
    }
  }
}
```

### Trend Following 策略

```typescript
class TrendStrategy {
  async execute(): Promise<void> {
    const signals = await this.analyzer.getSignals();
    
    for (const signal of signals) {
      if (signal.action === 'buy') {
        await this.executeBuy(signal);
      } else if (signal.action === 'sell') {
        await this.executeSell(signal);
      }
    }
  }
  
  async analyzeTrend(pair: string): Promise<Signal> {
    const prices = await this.getPriceHistory(pair, 50);
    const sma20 = this.calculateSMA(prices, 20);
    const sma50 = this.calculateSMA(prices, 50);
    
    // Golden cross: buy signal
    if (sma20 > sma50 && !this.hasPosition(pair)) {
      return { action: 'buy', pair, price: prices[0] };
    }
    
    // Death cross: sell signal
    if (sma20 < sma50 && this.hasPosition(pair)) {
      return { action: 'sell', pair, price: prices[0] };
    }
    
    return { action: 'hold' };
  }
}
```

---

## 7️⃣ 数据存储

### SQLite Schema

```sql
-- Trades table
CREATE TABLE trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  digest TEXT UNIQUE NOT NULL,  -- Sui tx digest
  dex TEXT NOT NULL,
  coin_in TEXT NOT NULL,        -- e.g., '0x2::sui::SUI'
  coin_out TEXT NOT NULL,
  amount_in TEXT NOT NULL,      -- Store as string (bigint)
  amount_out TEXT NOT NULL,
  gas_used TEXT NOT NULL,
  strategy TEXT NOT NULL,
  status TEXT NOT NULL          -- success | failed | pending
);

-- Price alerts
CREATE TABLE alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coin_type TEXT NOT NULL,
  target_price REAL NOT NULL,
  condition TEXT NOT NULL,      -- above | below
  active INTEGER DEFAULT 1
);

-- Strategy state
CREATE TABLE strategy_state (
  strategy TEXT PRIMARY KEY,
  enabled INTEGER DEFAULT 1,
  last_run INTEGER,
  config TEXT                   -- JSON
);

-- Positions (for trend strategy)
CREATE TABLE positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coin_type TEXT NOT NULL,
  amount TEXT NOT NULL,
  entry_price REAL NOT NULL,
  entry_time INTEGER NOT NULL,
  stop_loss REAL,
  take_profit REAL,
  status TEXT DEFAULT 'open'    -- open | closed
);
```

---

## 8️⃣ 风险管理

### 熔断机制

```typescript
class CircuitBreaker {
  private consecutiveFailures = 0;
  private lastFailureTime = 0;
  
  async checkHealth(): Promise<boolean> {
    if (this.consecutiveFailures >= 5) {
      const cooldownMs = 60 * 60 * 1000; // 1 hour
      if (Date.now() - this.lastFailureTime < cooldownMs) {
        return false; // Circuit is open
      }
      this.reset();
    }
    return true;
  }
  
  recordFailure(): void {
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();
    
    if (this.consecutiveFailures >= 5) {
      logger.error('Circuit breaker triggered!');
      this.bot.notify('🚨 Trading paused due to multiple failures');
    }
  }
  
  recordSuccess(): void {
    this.consecutiveFailures = 0;
  }
}
```

### 仓位限制

```typescript
class RiskManager {
  async validateTrade(trade: TradeParams): Promise<void> {
    // 1. Check single trade limit
    if (trade.amountUSD > this.config.maxTradeUSD) {
      throw new Error('Trade exceeds max limit');
    }
    
    // 2. Check daily trade count
    const todayTrades = await this.db.countTradesToday();
    if (todayTrades >= this.config.maxDailyTrades) {
      throw new Error('Daily trade limit reached');
    }
    
    // 3. Check daily loss
    const todayPnL = await this.db.calculateTodayPnL();
    if (todayPnL < -this.config.maxDailyLossUSD) {
      throw new Error('Daily loss limit exceeded');
    }
  }
}
```

---

## 9️⃣ Telegram Bot

### 命令列表

```
/start       - 启动机器人
/status      - 查看策略状态和持仓
/balance     - 查看钱包余额
/dca         - 配置定投策略
/trend       - 配置趋势策略
/buy <coin> <amount> - 手动买入
/sell <coin> <amount> - 手动卖出
/pause       - 暂停所有交易
/resume      - 恢复交易
/emergency   - 紧急平仓
/config      - 查看/修改配置
/logs        - 查看最近日志
```

### 实现示例

```typescript
import { Bot } from 'grammy';

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

bot.command('status', async (ctx) => {
  const balance = await wallet.getBalance();
  const positions = await db.getOpenPositions();
  const dcaEnabled = await db.getStrategyState('dca');
  
  const message = `
📊 **Status Report**

**Wallet Balance:**
SUI: ${balance.sui} (~$${balance.suiUSD})
USDC: ${balance.usdc}

**Strategies:**
DCA: ${dcaEnabled ? '✅ Enabled' : '❌ Disabled'}
Trend: ${trendEnabled ? '✅ Enabled' : '❌ Disabled'}

**Open Positions:** ${positions.length}
${positions.map(p => `- ${p.coin}: ${p.amount} (entry: $${p.entryPrice})`).join('\n')}
  `.trim();
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
});

bot.command('emergency', async (ctx) => {
  await ctx.reply(
    '⚠️ Emergency exit will sell ALL positions at market price. Confirm?',
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Confirm', callback_data: 'emergency_confirm' },
            { text: '❌ Cancel', callback_data: 'emergency_cancel' },
          ],
        ],
      },
    }
  );
});

bot.on('callback_query:data', async (ctx) => {
  if (ctx.callbackQuery.data === 'emergency_confirm') {
    await executeEmergencyExit();
    await ctx.editMessageText('✅ Emergency exit completed');
  }
});
```

---

## 🔟 备份系统

### 双重备份（与 EVM 版本相同）

**Cloudflare R2:**
```typescript
async function backupToR2(): Promise<void> {
  const dbPath = '~/.tangyuan/data.db';
  const timestamp = Date.now();
  const filename = `backup-${timestamp}.db.gz`;
  
  // Compress database
  const compressed = await gzip(await fs.readFile(dbPath));
  
  // Upload to R2
  await r2.putObject({
    Bucket: 'tangyuan-backups',
    Key: `sui/${filename}`,
    Body: compressed,
  });
  
  logger.info(`Backup uploaded: ${filename}`);
}
```

**GitHub JSON Export:**
```typescript
async function exportToGitHub(): Promise<void> {
  const trades = await db.getAllTrades();
  const positions = await db.getAllPositions();
  
  const data = {
    exportedAt: new Date().toISOString(),
    trades,
    positions,
  };
  
  const filename = `trades-${Date.now()}.json`;
  await fs.writeFile(filename, JSON.stringify(data, null, 2));
  
  // Git commit and push
  await exec(`git add ${filename}`);
  await exec(`git commit -m "Daily backup: ${new Date().toISOString()}"`);
  await exec('git push');
}
```

---

## 1️⃣1️⃣ 部署

### VPS + PM2

**PM2 配置：**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'tangyuan-sui-bot',
    script: './dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      SUI_NETWORK: 'mainnet',
    },
    error_file: '~/.tangyuan/logs/error.log',
    out_file: '~/.tangyuan/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  }]
};
```

**启动脚本：**
```bash
#!/bin/bash
# scripts/deploy.sh

set -e

echo "Building project..."
npm run build

echo "Starting PM2..."
pm2 start ecosystem.config.js

echo "Saving PM2 config..."
pm2 save

echo "Setup auto-start..."
pm2 startup

echo "✅ Deployment complete!"
```

---

## 1️⃣2️⃣ 测试策略

### Devnet 测试

```bash
# 1. Get devnet SUI from faucet
curl -X POST https://faucet.devnet.sui.io/gas \
  -H 'Content-Type: application/json' \
  -d '{"FixedAmountRequest": {"recipient": "YOUR_ADDRESS"}}'

# 2. Run bot in devnet mode
SUI_NETWORK=devnet npm run dev

# 3. Test manual trade
# (via Telegram) /buy SUI 0.1
```

### 主网小额验证

```bash
# Test with $10 only
SUI_NETWORK=mainnet \
MAX_TRADE_USD=10 \
npm start
```

---

## 📊 技术指标

### 预期性能

- **交易延迟**: < 3 秒（从信号到链上确认）
- **Gas 费用**: ~$0.001 per trade
- **内存占用**: < 200MB
- **CPU 占用**: < 5%（空闲时）

### 可靠性目标

- **Uptime**: > 99.5%
- **交易成功率**: > 95%
- **备份成功率**: 100%

---

## 🚀 开发计划

详见 [ROADMAP.md](../ROADMAP.md)

---

⚪ 设计完成，准备实施！
