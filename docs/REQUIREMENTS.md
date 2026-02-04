# Requirements Specification

## Arbitrage Strategy

### 1. Arbitrage Types
- **Primary**: Cross-DEX arbitrage (Cetus vs Turbos)
- **Secondary**: Cyclic arbitrage (triangle arbitrage within single DEX)
- **Priority**: Cross-DEX first, then cyclic

### 2. Token Pool Coverage
- **Scope**: Scan ALL pools (not limited to major tokens)
- **Risk**: Accept higher risk for more opportunities
- **Note**: Pool count on Sui is manageable, computation cost should be acceptable

### 3. Minimum Profit Threshold
- **Default**: 1% (after gas)
- **Configurable**: Can be adjusted via config

### 4. Monitoring Frequency
- **Initial**: High-frequency polling (100ms - 1s)
- **Fallback**: Medium-frequency (5-10s) if RPC cost becomes too high
- **Implementation**: Start with 1s, monitor costs, adjust as needed

### 5. Capital Management
- **Initial Capital**: $1,000
- **Per-Trade Limit**: 10% ($100)
- **Asset Allocation**: Distributed across multiple tokens (SUI/USDC/WETH/etc.)
- **Rebalancing**: Automatic rebalancing when distribution skews

### 6. Path Discovery
- **Strategy**: Dynamic path discovery using graph algorithm
- **Max Hops**: 4 (e.g., SUI → USDC → WETH → DAI → SUI)
- **Rationale**: Total pool count is limited, computation cost manageable

### 7. Failure Handling
- **Strategy**: Strict slippage protection
- **Slippage Tolerance**: 0.5% (configurable)
- **Action**: Revert transaction if slippage exceeds threshold

### 8. DEX Coverage (MVP)
- **Included**: Cetus + Turbos
- **Excluded**: DeepBook, FlowX, Kriya (future expansion)

### 9. Notification Strategy
- **Phase 1 (Early)**: Notify on every arbitrage (success + failure)
- **Phase 2 (Later)**: Switch to periodic reports (hourly/daily)
- **Format**: Telegram messages with profit/loss details

### 10. Testing & Deployment
- **Testing**: Devnet is sufficient
- **Mainnet Initial**: $10 - $100 test trades
- **Automation**: Fully automated (no manual confirmation)

---

## Technical Constraints

### Performance Targets
- **Arbitrage Detection**: < 100ms per cycle
- **Transaction Execution**: < 3s (signal to on-chain confirmation)
- **Memory Usage**: < 500MB
- **Uptime**: > 99%

### Risk Limits
- **Max Single Trade**: $100 (10% of capital)
- **Max Daily Loss**: $200 (20% of capital)
- **Circuit Breaker**: Pause after 5 consecutive failures

### Cost Management
- **Gas per Trade**: ~$0.001
- **RPC Calls**: Monitor cost, optimize if needed
- **Profitability**: Profit must exceed (gas + slippage + RPC costs)

---

## Development Priority

1. **Week 1**: Price monitoring + Cross-DEX arbitrage detection
2. **Week 2**: Execution engine + Capital management
3. **Week 3**: Cyclic arbitrage + Path discovery
4. **Week 4**: Testing + Optimization + Mainnet launch

---

Last updated: 2026-02-04
