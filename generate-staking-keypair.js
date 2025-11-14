const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');

const keypair = Keypair.generate();

console.log('=== STAKING POOL KEYPAIR GENERATED ===');
console.log('Public Key (STAKING_POOL_ADDRESS):', keypair.publicKey.toString());
console.log('Private Key (STAKING_POOL_PRIVATE_KEY):', bs58.encode(keypair.secretKey));
console.log('\nAdd these to your .env file:');
console.log(`STAKING_POOL_ADDRESS=${keypair.publicKey.toString()}`);
console.log(`STAKING_POOL_PRIVATE_KEY=${bs58.encode(keypair.secretKey)}`);
console.log('\nIMPORTANT: Keep the private key SECRET! Never commit it to git!');


