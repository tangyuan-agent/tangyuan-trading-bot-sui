# 🥟 Tangyuan Trading Bot (Sui)

> An intelligent, modular DeFi trading bot for Sui blockchain.

[中文文档](./README_zh.md)

## Features

- 🎯 **Multi-Strategy**: DCA (Dollar-Cost Averaging) + Trend Following
- 🔗 **Sui Native**: Built for Sui blockchain with Move integration
- 🌊 **Multi-DEX**: Cetus + Turbos, with best-price routing
- 🛡️ **Risk Management**: Auto circuit-breaker, emergency exit, position limits
- 💬 **Telegram Control**: Full bot control via Telegram commands
- 📊 **Smart Execution**: On-chain price verification, gas optimization
- 💾 **Persistent Storage**: SQLite + dual backup (R2 + GitHub)

## Architecture

```
src/
├── bot/            # Telegram bot interface
├── strategies/     # Trading strategies (DCA, Trend)
├── dex/            # DEX adapters (Cetus, Turbos)
├── blockchain/     # Sui chain interaction (@mysten/sui.js)
├── db/             # Database operations (SQLite)
├── risk/           # Risk management & circuit breakers
├── backup/         # R2 + GitHub backup automation
└── utils/          # Shared utilities
```

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your keys

# Run in development (Sui devnet)
npm run dev

# Run in production (mainnet)
npm start
```

## Documentation

- [Technical Design](./docs/DESIGN.md)
- [中文技术方案](./docs/DESIGN_zh.md)
- [API Reference](./docs/API.md)
- [Strategy Guide](./docs/STRATEGIES.md)

## Supported DEXes (MVP)

- ✅ **Cetus Protocol** - Primary AMM (largest TVL)
- ✅ **Turbos Finance** - Secondary AMM

## Development Roadmap

See [ROADMAP.md](./ROADMAP.md) for detailed development plan.

## License

MIT

---

⚪ Built with care by Tangyuan
