# 🥟 汤圆交易机器人 (Sui 版)

> 为 Sui 区块链打造的智能化、模块化 DeFi 交易机器人。

[English](./README.md)

## 核心特性

- 🎯 **多策略**：定投（DCA）+ 趋势跟踪
- 🔗 **Sui 原生**：专为 Sui 区块链和 Move 语言设计
- 🌊 **多 DEX**：Cetus + Turbos，智能路由最优价格
- 🛡️ **风险管理**：自动熔断、紧急退出、仓位限制
- 💬 **Telegram 控制**：完整的机器人命令控制
- 📊 **智能执行**：链上价格验证、Gas 优化
- 💾 **持久化存储**：SQLite + 双重备份（R2 + GitHub）

## 技术架构

```
src/
├── bot/            # Telegram 机器人接口
├── strategies/     # 交易策略（DCA、趋势跟踪）
├── dex/            # DEX 适配器（Cetus、Turbos）
├── blockchain/     # Sui 链交互（@mysten/sui.js）
├── db/             # 数据库操作（SQLite）
├── risk/           # 风险管理与熔断机制
├── backup/         # R2 + GitHub 自动备份
└── utils/          # 共用工具
```

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的密钥

# 开发环境运行（Sui devnet）
npm run dev

# 生产环境运行（mainnet）
npm start
```

## 文档

- [技术设计方案](./docs/DESIGN_zh.md)
- [English Technical Design](./docs/DESIGN.md)
- [API 参考](./docs/API.md)
- [策略指南](./docs/STRATEGIES.md)

## 支持的 DEX（MVP 阶段）

- ✅ **Cetus Protocol** - 主要 AMM（TVL 最大）
- ✅ **Turbos Finance** - 次要 AMM

## 开发路线图

详见 [ROADMAP.md](./ROADMAP.md)

## 许可证

MIT

---

⚪ 汤圆出品，用心打造
