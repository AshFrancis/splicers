import * as Client from 'gene_splicer';
import { rpcUrl, networkPassphrase } from './util';

// CRITICAL: Contract ID must be updated in .env after EVERY deployment!
// The auto-generated TypeScript bindings cannot be relied upon for staging/production.
// Always use PUBLIC_GENE_SPLICER_CONTRACT_ID from .env as the single source of truth.
const contractId = import.meta.env.PUBLIC_GENE_SPLICER_CONTRACT_ID;

if (!contractId) {
  throw new Error('PUBLIC_GENE_SPLICER_CONTRACT_ID is not set in .env - cannot initialize contract client');
}

console.log('🔍 Gene Splicer Config:', {
  contractId,
  networkPassphrase,
  rpcUrl,
});

export default new Client.Client({
  networkPassphrase,
  contractId,
  rpcUrl,
  allowHttp: true,
  publicKey: undefined,
});
