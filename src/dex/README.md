# DEX Integration

## Overview

This module integrates with Sui DEXes (Cetus and Turbos) to fetch pool information and calculate arbitrage opportunities.

## Architecture

```
dex/
├── types.ts              # Common DEX types
├── pool-registry.ts      # Central pool management
└── adapters/
    ├── cetus.ts          # Cetus DEX adapter
    └── turbos.ts         # Turbos DEX adapter
```

## TODO: Update Contract Addresses

Before running on mainnet, update the following addresses in adapter files:

### Cetus (`adapters/cetus.ts`)

```typescript
const CETUS_CONFIG = {
  globalConfigId: '0x...',  // ⚠️ UPDATE THIS
  packageId: '0x...',       // ⚠️ UPDATE THIS
  poolCreatedType: '0x...', // ⚠️ UPDATE THIS
};
```

**How to find:**
1. Visit Cetus docs: https://cetus-1.gitbook.io/cetus-docs
2. Or check Sui Explorer for Cetus contracts
3. Or use Sui CLI: `sui client objects --address <cetus-address>`

### Turbos (`adapters/turbos.ts`)

```typescript
const TURBOS_CONFIG = {
  poolRegistryId: '0x...',  // ⚠️ UPDATE THIS
  packageId: '0x...',       // ⚠️ UPDATE THIS
  poolCreatedType: '0x...', // ⚠️ UPDATE THIS
};
```

**How to find:**
1. Visit Turbos docs
2. Or check their deployed contracts on Sui mainnet

## Pool Discovery Strategy

Both adapters use **event-based discovery**:

1. Query `PoolCreated` events from DEX factory contracts
2. Parse event data to extract:
   - Pool ID
   - Token pair (coinTypeA, coinTypeB)
   - Fee rate
3. Cache pool metadata
4. Fetch reserves on-demand via `getPoolReserves()`

## Price Calculation

Uses constant product AMM formula (Uniswap V2 style):

```
amountOut = (amountIn * (1 - fee) * reserveOut) / (reserveIn + amountIn * (1 - fee))
```

Default fee: 0.3% (3000 basis points)

## Token Graph

The `PoolRegistry` builds a directed graph where:
- **Nodes**: Tokens (coin types)
- **Edges**: Pools connecting two tokens

This enables efficient pathfinding for cyclic arbitrage.

## Usage

```typescript
import { PoolRegistry } from './dex/pool-registry';

const registry = new PoolRegistry(suiClient);

// Initialize (fetch all pools)
await registry.initialize(['cetus', 'turbos']);

// Get all pools
const pools = registry.getAllPools();

// Get price
const price = registry.getPrice(SUI, USDC, 'cetus');

// Get pools for a specific pair
const suiUsdcPools = registry.getPoolsForPair(SUI, USDC);

// Refresh reserves
await registry.refreshPoolReserves();
```

## Performance

- **Initial load**: ~2-5 seconds (fetching events)
- **Reserve refresh**: ~1-2 seconds per 50 pools (with rate limiting)
- **Price lookup**: O(1) from cache

## Future Improvements

- [ ] Batch reserve fetching (reduce RPC calls)
- [ ] Incremental updates (only fetch new pools)
- [ ] Support for concentrated liquidity (Cetus V3/Turbos V3)
- [ ] Real-time event subscriptions (WebSocket)
