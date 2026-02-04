# Development Roadmap

## Phase 1: MVP (Week 1-2)

### Week 1: Price Monitoring & Cross-DEX Arbitrage
- [ ] Project setup
  - [x] Initialize repository
  - [ ] Configure TypeScript + ESLint + Prettier
  - [ ] Setup package.json with @mysten/sui.js
- [ ] Blockchain layer
  - [ ] Wallet management (Ed25519Keypair encryption)
  - [ ] SuiClient setup with RPC fallbacks
  - [ ] Transaction builder utilities
  - [ ] Gas estimation helpers
- [ ] Pool discovery
  - [ ] Cetus pool scanner (fetch all active pools)
  - [ ] Turbos pool scanner
  - [ ] Token graph builder
- [ ] Price monitoring
  - [ ] PoolRegistry (store & update pool states)
  - [ ] High-frequency poller (1s interval)
  - [ ] Price calculation from reserves
- [ ] Cross-DEX arbitrage detector
  - [ ] Price spread calculator
  - [ ] Opportunity filter (1% threshold)
  - [ ] Profit estimator (gas + slippage)
- [ ] Testing setup
  - [ ] Sui devnet fork with local validator
  - [ ] Test wallet with devnet SUI
  - [ ] Mock pool data

### Week 2: Execution Engine & Capital Management
- [ ] DEX execution
  - [ ] Cetus swap transaction builder
  - [ ] Turbos swap transaction builder
  - [ ] Slippage protection (0.5%)
  - [ ] Transaction confirmation & retry
- [ ] Cross-DEX execution
  - [ ] Two-step execution (buy then sell)
  - [ ] Error handling & rollback
  - [ ] Result logging
- [ ] Capital manager
  - [ ] Multi-token balance tracking
  - [ ] 10% per-trade limit enforcement
  - [ ] Initial allocation ($1000 → SUI/USDC/WETH/...)
- [ ] Telegram bot
  - [ ] Basic commands (/start, /status, /balance)
  - [ ] Manual trade commands (/buy, /sell)
  - [ ] Arbitrage notifications (every trade)
  - [ ] Emergency stop (/pause)
- [ ] Database
  - [ ] SQLite schema (trades, balances, opportunities)
  - [ ] Arbitrage logging
  - [ ] Performance metrics
- [ ] Testing
  - [ ] End-to-end test on devnet
  - [ ] Small mainnet test ($10-$100)

## Phase 2: Cyclic Arbitrage & Optimization (Week 3-4)

### Week 3: Cyclic Arbitrage (Triangle Arbitrage)
- [ ] Graph-based path finder
  - [ ] Token graph construction from pools
  - [ ] DFS with memoization (max 4 hops)
  - [ ] Cycle detection & deduplication
- [ ] Cyclic arbitrage detector
  - [ ] Path profitability calculator
  - [ ] Filter by 1% threshold
  - [ ] Priority ranking (profit vs. gas)
- [ ] Atomic execution
  - [ ] Multi-swap TransactionBlock builder
  - [ ] All-or-nothing execution (revert on loss)
  - [ ] Result verification
- [ ] Capital rebalancing
  - [ ] Automatic rebalancing when skewed
  - [ ] Minimal-cost rebalancing strategy
- [ ] Risk management
  - [ ] Circuit breaker (5 consecutive failures)
  - [ ] Daily loss limit ($200)
  - [ ] Real-time P&L tracking
- [ ] Logging
  - [ ] Pino logger setup
  - [ ] Structured JSON logs
  - [ ] Log rotation (daily, 30 days retention)

### Week 4: Testing, Deployment & Optimization
- [ ] Performance optimization
  - [ ] Pool caching (reduce RPC calls)
  - [ ] Batch RPC requests
  - [ ] Incremental updates for inactive pools
- [ ] Monitoring & alerts
  - [ ] Opportunity detection rate
  - [ ] Execution success rate
  - [ ] Daily/hourly P&L reports
  - [ ] Switch notifications from per-trade to reports
- [ ] Backup system
  - [ ] Daily SQLite backup to Cloudflare R2
  - [ ] JSON export to GitHub (private repo)
  - [ ] Restore scripts
- [ ] Deployment
  - [ ] PM2 configuration
  - [ ] Auto-restart on crash
  - [ ] Health check endpoint
- [ ] Mainnet launch
  - [ ] Final devnet validation
  - [ ] Mainnet deployment with $10-$100
  - [ ] Gradual capital increase
- [ ] Testing & profiling
  - [ ] Load testing
  - [ ] Gas cost analysis
  - [ ] Memory profiling

## Phase 3: Expansion (Future)

- [ ] More DEXes
  - [ ] DeepBook (CLOB) support
  - [ ] FlowX integration
  - [ ] Kriya integration
- [ ] Advanced arbitrage strategies
  - [ ] Flash loans (if available on Sui)
  - [ ] Multi-DEX cyclic arbitrage (3+ DEXes)
  - [ ] Cross-chain arbitrage (Sui ↔ other chains)
- [ ] MEV protection
  - [ ] Private mempool submission
  - [ ] Transaction priority optimization
- [ ] Analytics dashboard
  - [ ] Web UI for monitoring
  - [ ] Historical performance charts
  - [ ] Opportunity heatmap
  - [ ] Backtest simulator
- [ ] Multi-wallet support
  - [ ] Manage multiple accounts
  - [ ] Coordinated multi-wallet arbitrage
  - [ ] Capital pooling

---

## Current Status

**Phase:** 1 (MVP)  
**Week:** 1 (Price Monitoring & Cross-DEX Arbitrage)  
**Progress:** 10% (Project structure complete, starting implementation)

**Next Steps:**
1. Implement SuiClient + wallet management
2. Build Cetus & Turbos pool scanners
3. Create price monitoring engine

Last updated: 2026-02-04
