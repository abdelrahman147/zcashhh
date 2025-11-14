/**
 * SMART CONTRACT SERVICE - Oracle Staking
 * Handles deployment and interaction with Solana staking smart contract
 */

class SmartContractService {
    constructor(bridge) {
        this.bridge = bridge;
        this.programId = new PublicKey('Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS');
        this.stakingPoolPDA = null;
        this.minStake = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL minimum
    }

    async initialize() {
        if (!this.bridge || !this.bridge.solanaConnection) {
            throw new Error('Solana connection not available');
        }

        await this.bridge.loadSolanaWeb3();
        const { PublicKey, SystemProgram } = this.bridge.SolanaWeb3;

        // Derive staking pool PDA
        const [stakingPoolPDA, bump] = await PublicKey.findProgramAddress(
            [Buffer.from('staking_pool')],
            this.programId
        );

        this.stakingPoolPDA = stakingPoolPDA;
        this.stakingPoolBump = bump;

        console.log('✅ Smart contract service initialized');
        console.log(`   Program ID: ${this.programId.toString()}`);
        console.log(`   Staking Pool PDA: ${this.stakingPoolPDA.toString()}`);
    }

    async getStakingPoolInfo() {
        if (!this.stakingPoolPDA) {
            await this.initialize();
        }

        try {
            const accountInfo = await this.bridge.solanaConnection.getAccountInfo(this.stakingPoolPDA);
            if (!accountInfo) {
                return null; // Pool not initialized
            }

            // Decode account data (simplified - in production use proper deserialization)
            const data = accountInfo.data;
            return {
                authority: new PublicKey(data.slice(0, 32)),
                minStake: data.readBigUInt64LE(32),
                totalStaked: data.readBigUInt64LE(40),
                totalNodes: data.readBigUInt64LE(48),
                bump: data[56]
            };
        } catch (error) {
            console.error('Error getting staking pool info:', error);
            return null;
        }
    }

    async getNodeStake(nodeAddress) {
        if (!this.stakingPoolPDA) {
            await this.initialize();
        }

        try {
            const nodePubkey = new PublicKey(nodeAddress);
            const [nodeStakePDA] = await PublicKey.findProgramAddress(
                [Buffer.from('node_stake'), nodePubkey.toBuffer()],
                this.programId
            );

            const accountInfo = await this.bridge.solanaConnection.getAccountInfo(nodeStakePDA);
            if (!accountInfo) {
                return { amount: 0, stakedAt: null };
            }

            const data = accountInfo.data;
            return {
                nodeAddress: new PublicKey(data.slice(0, 32)),
                amount: Number(data.readBigUInt64LE(32)),
                stakedAt: Number(data.readBigInt64LE(40)),
                lastUpdate: Number(data.readBigInt64LE(48))
            };
        } catch (error) {
            console.error('Error getting node stake:', error);
            return { amount: 0, stakedAt: null };
        }
    }

    async createStakeTransaction(nodeAddress, amount) {
        if (!this.stakingPoolPDA) {
            await this.initialize();
        }

        await this.bridge.loadSolanaWeb3();
        const { Transaction, SystemProgram, PublicKey } = this.bridge.SolanaWeb3;

        const nodePubkey = new PublicKey(nodeAddress);
        const amountLamports = Math.floor(amount * LAMPORTS_PER_SOL);

        // Derive PDAs
        const [nodeStakePDA, nodeStakeBump] = await PublicKey.findProgramAddress(
            [Buffer.from('node_stake'), nodePubkey.toBuffer()],
            this.programId
        );

        // Create stake instruction
        const stakeIx = await this.createStakeInstruction(
            nodePubkey,
            nodeStakePDA,
            amountLamports,
            nodeStakeBump
        );

        const transaction = new Transaction();
        transaction.add(stakeIx);

        const { blockhash } = await this.bridge.solanaConnection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = nodePubkey;

        return transaction;
    }

    async createStakeInstruction(nodePubkey, nodeStakePDA, amount, bump) {
        // In production, use Anchor IDL to generate instructions
        // For now, create instruction manually
        const { PublicKey, SystemProgram } = this.bridge.SolanaWeb3;

        const keys = [
            { pubkey: this.stakingPoolPDA, isSigner: false, isWritable: true },
            { pubkey: nodeStakePDA, isSigner: false, isWritable: true },
            { pubkey: nodePubkey, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
        ];

        const data = Buffer.alloc(8 + 8);
        data.writeUInt8(1, 0); // Stake instruction discriminator
        data.writeBigUInt64LE(BigInt(amount), 8);

        return {
            keys,
            programId: this.programId,
            data
        };
    }

    async createUnstakeTransaction(nodeAddress, amount) {
        if (!this.stakingPoolPDA) {
            await this.initialize();
        }

        await this.bridge.loadSolanaWeb3();
        const { Transaction, SystemProgram, PublicKey } = this.bridge.SolanaWeb3;

        const nodePubkey = new PublicKey(nodeAddress);
        const amountLamports = Math.floor(amount * LAMPORTS_PER_SOL);

        const [nodeStakePDA] = await PublicKey.findProgramAddress(
            [Buffer.from('node_stake'), nodePubkey.toBuffer()],
            this.programId
        );

        const unstakeIx = await this.createUnstakeInstruction(
            nodePubkey,
            nodeStakePDA,
            amountLamports
        );

        const transaction = new Transaction();
        transaction.add(unstakeIx);

        const { blockhash } = await this.bridge.solanaConnection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = nodePubkey;

        return transaction;
    }

    async createUnstakeInstruction(nodePubkey, nodeStakePDA, amount) {
        const { PublicKey, SystemProgram } = this.bridge.SolanaWeb3;

        const seeds = [
            Buffer.from('staking_pool'),
            Buffer.from([this.stakingPoolBump])
        ];

        const keys = [
            { pubkey: this.stakingPoolPDA, isSigner: false, isWritable: true },
            { pubkey: nodeStakePDA, isSigner: false, isWritable: true },
            { pubkey: nodePubkey, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
        ];

        const data = Buffer.alloc(8 + 8);
        data.writeUInt8(2, 0); // Unstake instruction discriminator
        data.writeBigUInt64LE(BigInt(amount), 8);

        return {
            keys,
            programId: this.programId,
            data
        };
    }
}

if (typeof window !== 'undefined') {
    window.SmartContractService = SmartContractService;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SmartContractService;
}


