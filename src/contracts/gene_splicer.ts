import * as Client from 'gene_splicer';
import { rpcUrl, networkPassphrase } from './util';

// TESTNET CONTRACT ID - deployed to Stellar testnet
const contractId = 'CA2N3R2NPLA72XR67RMOJK3HALROY7KHPPU5E5BUFKTWVURT6CBVQ5FL';

console.log('🔍 Gene Splicer Config:', {
  contractId,
  networkPassphrase,
  rpcUrl,
  env_var: import.meta.env.PUBLIC_GENE_SPLICER_CONTRACT_ID
});

export default new Client.Client({
  networkPassphrase,
  contractId,
  rpcUrl,
  allowHttp: true,
  publicKey: undefined,
});
