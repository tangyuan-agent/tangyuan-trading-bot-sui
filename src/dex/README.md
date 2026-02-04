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

## ✅ Contract Addresses (Updated)

Mainnet contract addresses have been configured from official sources:

### Cetus (`adapters/cetus.ts`)

```typescript
const CETUS_CONFIG = {
  globalConfigId: '0xdaa46292632c3c4d8f31f23ea0f9b36a28ff3677e9684980e4438403a67a3d8f',
  packageId: '0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb',
  publishedAt: '0xc6faf3703b0e8ba9ed06b7851134bbbe7565eb35ff823fd78432baa4cbeaa12e',
  poolsId: '0xf699e7f2276f5c9a75944b37a0c5b5d9ddfd2471bf6242483b03ab2887d198d0',
};
```

**Source**: https://github.com/CetusProtocol/cetus-clmm-sui-sdk/blob/main/src/config/mainnet.ts

### Turbos (`adapters/turbos.ts`)

```typescript
const TURBOS_CONFIG = {
  packageId: '0xa5a0c25c79e428eba04fb98b3fb2a34db45ab26d4c8faf0d7e39d66a63891e64',
  poolConfig: '0xc294552b2765353bcafa7c359cd28fd6bc237662e5db8f09877558d81669170c',
  poolTableId: '0x08984ed8705f44b6403705dc248896e56ab7961447820ae29be935ce0d32198b',
  positions: '0xf5762ae5ae19a2016bb233c72d9a4b2cba5a302237a82724af66292ae43ae52d',
  versioned: '0xf1cf0e81048df168ebeb1b8030fad24b3e0b53ae827c25053fff0779c1445b6f',
};
```

**Source**: https://s3.amazonaws.com/app.turbos.finance/sdk/contract.json

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
