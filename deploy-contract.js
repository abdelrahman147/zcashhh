/**
 * DEPLOY SMART CONTRACT - Oracle Staking Program
 * Run: node deploy-contract.js
 */

const { Connection, Keypair, PublicKey, SystemProgram, sendAndConfirmTransaction, Transaction } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const anchor = require('@coral-xyz/anchor');

const PROGRAM_ID = new PublicKey('Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS');
const LAMPORTS_PER_SOL = 1000000000;

async function deployContract() {
    try {
        // Connect to Solana cluster
        const connection = new Connection(
            process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
            'confirmed'
        );

        // Load deployer keypair
        const keypairPath = process.env.SOLANA_KEYPAIR_PATH || path.join(process.env.HOME || process.env.USERPROFILE, '.config/solana/id.json');
        const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
        const deployer = Keypair.fromSecretKey(Uint8Array.from(keypairData));

        console.log(`Deployer: ${deployer.publicKey.toString()}`);

        // Check balance
        const balance = await connection.getBalance(deployer.publicKey);
        console.log(`Balance: ${balance / LAMPORTS_PER_SOL} SOL`);

        if (balance < 2 * LAMPORTS_PER_SOL) {
            throw new Error('Insufficient balance for deployment (need at least 2 SOL)');
        }

        // Load program binary
        const programPath = path.join(__dirname, 'target', 'deploy', 'oracle_staking.so');
        if (!fs.existsSync(programPath)) {
            throw new Error(`Program binary not found at ${programPath}. Build the program first with: anchor build`);
        }

        const programData = fs.readFileSync(programPath);

        // Create buffer account
        const bufferKeypair = Keypair.generate();
        const bufferSize = programData.length + 1000; // Add some padding

        console.log('Creating buffer account...');
        const createBufferTx = new Transaction().add(
            SystemProgram.createAccount({
                fromPubkey: deployer.publicKey,
                newAccountPubkey: bufferKeypair.publicKey,
                lamports: await connection.getMinimumBalanceForRentExemption(bufferSize),
                space: bufferSize,
                programId: SystemProgram.programId,
            })
        );

        await sendAndConfirmTransaction(
            connection,
            createBufferTx,
            [deployer, bufferKeypair]
        );

        console.log('Buffer created:', bufferKeypair.publicKey.toString());

        // Write program data to buffer
        console.log('Writing program data...');
        // This would use bpfLoader in production
        // For now, we'll use Anchor's deployment

        console.log('✅ Deployment script ready. Use Anchor CLI:');
        console.log('   1. anchor build');
        console.log('   2. anchor deploy --provider.cluster mainnet-beta');

    } catch (error) {
        console.error('Deployment error:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    deployContract();
}

module.exports = { deployContract };


