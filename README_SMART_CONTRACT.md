# Oracle Staking Smart Contract

## Overview
Custom Solana smart contract for oracle node staking. Replaces liquid staking pools with a dedicated on-chain staking program.

## Program ID
`Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS`

## Features
- **Stake**: Lock SOL to become an oracle node
- **Unstake**: Withdraw staked SOL
- **Slash**: Penalize nodes for bad behavior (authority only)
- **Minimum Stake**: 0.1 SOL required
- **On-Chain Verification**: All stakes verified on blockchain

## Building & Deployment

### Prerequisites
```bash
# Install Anchor
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest

# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
```

### Build
```bash
anchor build
```

### Deploy to Devnet
```bash
anchor deploy --provider.cluster devnet
```

### Deploy to Mainnet
```bash
anchor deploy --provider.cluster mainnet-beta
```

## Smart Contract Structure

### Accounts

#### StakingPool
- `authority`: Pool authority (can slash nodes)
- `min_stake`: Minimum stake amount (lamports)
- `total_staked`: Total SOL staked
- `total_nodes`: Number of active nodes
- `bump`: PDA bump seed

#### NodeStake
- `node_address`: Node's public key
- `amount`: Staked amount (lamports)
- `staked_at`: Timestamp when first staked
- `last_update`: Last update timestamp

### Instructions

1. **initialize**: Initialize the staking pool
   - Sets minimum stake
   - Sets authority

2. **stake**: Stake SOL to become a node
   - Transfers SOL to pool
   - Creates/updates NodeStake account
   - Emits StakeEvent

3. **unstake**: Withdraw staked SOL
   - Updates NodeStake account
   - Transfers SOL back to user
   - Emits UnstakeEvent

4. **slash_node**: Slash a node (authority only)
   - Reduces node's stake
   - Emits SlashEvent

## Integration

The backend (`server.js`) now uses the smart contract instead of liquid staking pools. The endpoint `/api/oracle/stake` creates transactions that interact with the on-chain program.

## Testing

```bash
anchor test
```

## Security

- All stakes are verified on-chain
- No fake data - only blockchain-verified amounts
- Slashing mechanism for bad actors
- Minimum stake requirement enforced


