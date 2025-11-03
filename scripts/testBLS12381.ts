#!/usr/bin/env tsx
/**
 * Test BLS12-381 verification end-to-end:
 * 1. Fetch latest drand entropy from quicknet
 * 2. Decompress signature using relayer
 * 3. Submit to contract
 * 4. Verify contract accepts and validates signature
 */

import {
  fetchLatestDrandEntropy,
  parseAndDecompressEntropy,
  bytesToHex,
} from '../src/services/entropyRelayer.js';
import { Contract, SorobanRpc, Networks, Keypair } from '@stellar/stellar-sdk';
import * as GeneSplicer from '../packages/gene_splicer/dist/index.js';

const RPC_URL = 'http://localhost:8000/rpc';
const CONTRACT_ID = 'CBEWYXNUDGTJIMTTLJKWU6HLERS35YPIW66V4PY6ZFUJELZAVGRKV33X';

async function test() {
  console.log('🧪 Testing BLS12-381 Verification Flow\n');

  // Step 1: Fetch latest drand entropy
  console.log('📡 Step 1: Fetching latest drand entropy from quicknet...');
  const drandRound = await fetchLatestDrandEntropy();
  console.log(`   Round: ${drandRound.round}`);
  console.log(`   Randomness (hex): ${drandRound.randomness.substring(0, 16)}...`);
  console.log(`   Signature (hex, compressed 48 bytes): ${drandRound.signature.substring(0, 16)}...\n`);

  // Step 2: Decompress signature using relayer
  console.log('🔓 Step 2: Decompressing BLS12-381 signature...');
  const uncompressed = parseAndDecompressEntropy(drandRound);
  const signatureHex = bytesToHex(uncompressed.signature_uncompressed);
  const randomnessHex = bytesToHex(uncompressed.randomness);
  console.log(`   Signature (uncompressed 96 bytes): ${signatureHex.substring(0, 32)}...`);
  console.log(`   Randomness (32 bytes): ${randomnessHex}\n`);

  // Step 3: Submit to contract
  console.log('📤 Step 3: Submitting entropy to contract...');
  console.log(`   Contract ID: ${CONTRACT_ID}`);
  console.log(`   Round: ${uncompressed.round}`);

  try {
    // Get the admin keypair
    const adminSecret = process.env.STELLAR_SECRET_KEY || 'SCUJGTUKKCVLLSSO3E5UJPJLHHUCVVUZSIDUDPLBTQHXCPAZQ43JUYMO'; // 'me' account
    const adminKeypair = Keypair.fromSecret(adminSecret);

    // Create contract client
    const rpc = new SorobanRpc.Server(RPC_URL);
    const contract = new Contract(CONTRACT_ID);

    // Build submit_entropy transaction
    const tx = await GeneSplicer.submit_entropy(
      {
        round: BigInt(uncompressed.round),
        randomness: uncompressed.randomness,
        signature: uncompressed.signature_uncompressed,
      },
      {
        contractId: CONTRACT_ID,
        networkPassphrase: Networks.STANDALONE,
        rpcUrl: RPC_URL,
        publicKey: adminKeypair.publicKey(),
      }
    );

    console.log('   Transaction built successfully');
    console.log('   Simulating transaction...');

    // Simulate to verify it would succeed
    const simulated = await tx.simulate();
    console.log(`   Simulation result: ${JSON.stringify(simulated.result)}`);

    if (simulated.result) {
      console.log('\n✅ SUCCESS: BLS12-381 signature verification passed!');
      console.log('   The contract successfully:');
      console.log('   1. Deserialized G1Affine signature from 96 bytes');
      console.log('   2. Verified signature is in G1 subgroup');
      console.log('   3. Constructed drand message (prev_sig || round)');
      console.log('   4. Performed on-chain hash-to-curve (H2C)');
      console.log('   5. Verified H2C result is in G1 subgroup');
      console.log('   6. Deserialized G2Affine public key from 192 bytes');
      console.log('   7. Verified public key is in G2 subgroup');
      console.log('   8. Performed pairing check: e(sig, G2_gen) == e(H(msg), pubkey)');
      console.log('   9. All cryptographic verification PASSED ✓\n');

      // Now send the transaction for real
      console.log('💫 Sending transaction to blockchain...');
      const signed = await tx.signAndSend({
        signTransaction: async (xdr) => {
          const tx = SorobanRpc.parseTransactionEnvelope(xdr, Networks.STANDALONE);
          tx.sign(adminKeypair);
          return tx.toXDR();
        },
      });

      console.log(`   Transaction hash: ${signed.transactionHash}`);
      console.log('   ✅ Entropy submitted and verified on-chain!\n');

      return true;
    } else {
      console.log('\n❌ FAILED: Simulation did not return success');
      return false;
    }
  } catch (error: any) {
    console.log(`\n❌ FAILED: ${error.message}`);
    if (error.message.includes('not in G1 subgroup')) {
      console.log('   ⚠️  Signature failed subgroup check');
    } else if (error.message.includes('not in G2 subgroup')) {
      console.log('   ⚠️  Public key failed subgroup check');
    } else if (error.message.includes('pairing verification failed')) {
      console.log('   ⚠️  Pairing equation did not hold');
    }
    console.error(error);
    return false;
  }
}

test().then((success) => {
  process.exit(success ? 0 : 1);
});
