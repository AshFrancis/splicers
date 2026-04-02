import * as Client from 'gene_splicer';
import { rpcUrl, networkPassphrase } from './util';

// Contract ID is read from PUBLIC_GENE_SPLICER_CONTRACT_ID in .env (local dev)
// and from TESTNET_CONTRACT_ID GitHub secret (CI/CD deployments).
const contractId = import.meta.env.PUBLIC_GENE_SPLICER_CONTRACT_ID;

if (!contractId) {
  throw new Error('PUBLIC_GENE_SPLICER_CONTRACT_ID is not set in .env - cannot initialize contract client');
}

export default new Client.Client({
  networkPassphrase,
  contractId,
  rpcUrl,
  allowHttp: true,
  publicKey: undefined,
});
