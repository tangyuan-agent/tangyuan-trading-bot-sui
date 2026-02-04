# Development Roadmap

## Phase 1: MVP (Week 1-2)

### Week 1: Core Infrastructure
- [ ] Project setup
  - [x] Initialize repository
  - [ ] Configure TypeScript + ESLint + Prettier
  - [ ] Setup package.json with @mysten/sui.js
- [ ] Blockchain layer
  - [ ] Wallet management (Ed25519Keypair encryption)
  - [ ] SuiClient setup with RPC fallbacks
  - [ ] Transaction builder utilities
  - [ ] Gas estimation helpers
- [ ] DEX adapters (read-only first)
  - [ ] Cetus adapter (quote only)
  - [ ] Turbos adapter (quote only)
  - [ ] DEX router (best price selection)
- [ ] Testing setup
  - [ ] Sui devnet fork with local validator
  - [ ] Test wallet with devnet SUI
  - [ ] Mock DEX pools

### Week 2: Trading & Control
- [ ] Strategy implementations
  - [ ] DCA strategy (time-based buy)
  - [ ] Strategy executor framework
- [ ] DEX execution
  - [ ] Cetus swap execution
  - [ ] Turbos swap execution
  - [ ] Slippage protection
  - [ ] Transaction confirmation & retry
- [ ] Telegram bot
  - [ ] Basic commands (/start, /status, /balance)
  - [ ] Manual trade commands (/buy, /sell)
  - [ ] Strategy control (/dca)
- [ ] Database
  - [ ] SQLite schema
  - [ ] Trade logging
  - [ ] Strategy state persistence
- [ ] Testing
  - [ ] End-to-end test on devnet
  - [ ] Small mainnet test ($10)

## Phase 2: Advanced Features (Week 3-4)

### Week 3: Risk & Monitoring
- [ ] Risk management
  - [ ] Circuit breaker (auto-pause on failures)
  - [ ] Position limits (max per trade, daily loss)
  - [ ] Emergency exit (/emergency command)
- [ ] Trend following strategy
  - [ ] Price data fetching (on-chain + API)
  - [ ] SMA indicators (20/50)
  - [ ] Entry/exit signals
  - [ ] Stop-loss & take-profit
- [ ] Logging
  - [ ] Pino logger setup
  - [ ] Structured JSON logs
  - [ ] Log rotation (daily, 30 days retention)
- [ ] Notifications
  - [ ] Trade execution alerts
  - [ ] Price alerts
  - [ ] Error notifications
  - [ ] Daily P&L reports

### Week 4: Reliability
- [ ] Backup system
  - [ ] Daily SQLite backup to Cloudflare R2
  - [ ] JSON export to GitHub (private repo)
  - [ ] Restore scripts
- [ ] Deployment
  - [ ] PM2 configuration
  - [ ] Auto-restart on crash
  - [ ] Health check endpoint
- [ ] Full Telegram commands
  - [ ] /pause, /resume
  - [ ] /config (modify settings)
  - [ ] /logs (recent activity)
  - [ ] Inline button support
- [ ] Testing & optimization
  - [ ] Load testing
  - [ ] Gas optimization
  - [ ] Memory profiling

## Phase 3: Expansion (Future)

- [ ] More DEXes
  - [ ] DeepBook (CLOB) support
  - [ ] FlowX integration
  - [ ] Kriya integration
- [ ] Advanced strategies
  - [ ] Arbitrage (cross-DEX)
  - [ ] Grid trading
  - [ ] Multi-pair portfolio
- [ ] Analytics dashboard
  - [ ] Web UI for monitoring
  - [ ] Historical performance charts
  - [ ] Backtest simulator
- [ ] Multi-wallet support
  - [ ] Manage multiple accounts
  - [ ] Cross-wallet arbitrage

---

## Current Status

**Phase:** 1 (MVP)  
**Week:** 1 (Infrastructure setup)  
**Progress:** 5%

Last updated: 2026-02-04
