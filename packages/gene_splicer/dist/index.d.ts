import { Buffer } from "buffer";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
} from "@stellar/stellar-sdk/contract";
import type { u32, u64, Option } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
export declare const networks: {
  readonly testnet: {
    readonly networkPassphrase: "Test SDF Network ; September 2015";
    readonly contractId: "CA2QL6PQBIQON3QOIXM4AFARITJOC4BFZH5BLLDHWK6MTWCPR4WHFN4O";
  };
};
/**
 * Gene rarity levels (affects visual appearance and value)
 */
export type GeneRarity =
  | {
      tag: "Normal";
      values: void;
    }
  | {
      tag: "Rare";
      values: void;
    }
  | {
      tag: "Legendary";
      values: void;
    };
/**
 * Individual gene with ID and rarity
 */
export interface Gene {
  id: u32;
  rarity: GeneRarity;
}
/**
 * Genome Cartridge NFT - minted when user splices, before finalization
 */
export interface GenomeCartridge {
  created_at: u64;
  finalized: boolean;
  id: u32;
  owner: string;
  skin_id: u32;
  splice_round: u64;
}
/**
 * Creature NFT - final form after finalization with entropy
 */
export interface Creature {
  body_gene: Gene;
  entropy_round: u64;
  finalized_at: u64;
  head_gene: Gene;
  id: u32;
  legs_gene: Gene;
  owner: string;
  skin_id: u32;
}
/**
 * Storage keys for the contract
 */
export type DataKey =
  | {
      tag: "Admin";
      values: void;
    }
  | {
      tag: "XlmToken";
      values: void;
    }
  | {
      tag: "CartridgeSkinCount";
      values: void;
    }
  | {
      tag: "NextCartridgeId";
      values: void;
    }
  | {
      tag: "Cartridge";
      values: readonly [u32];
    }
  | {
      tag: "UserCartridges";
      values: readonly [string];
    }
  | {
      tag: "Creature";
      values: readonly [u32];
    }
  | {
      tag: "UserCreatures";
      values: readonly [string];
    }
  | {
      tag: "DevMode";
      values: void;
    }
  | {
      tag: "DrandPublicKey";
      values: void;
    };
export interface Client {
  /**
   * Construct and simulate a splice_genome transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Mint a new Genome Cartridge NFT
   * - Transfers 1 XLM fee from user to admin
   * - Uses PRNG to select random cartridge skin
   * - Mints cartridge NFT with assigned splice_round
   * Returns the cartridge ID
   */
  splice_genome: (
    {
      user,
    }: {
      user: string;
    },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;
      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;
      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<u32>>;
  /**
   * Construct and simulate a get_cartridge transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get cartridge data by ID
   */
  get_cartridge: (
    {
      cartridge_id,
    }: {
      cartridge_id: u32;
    },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;
      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;
      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<Option<GenomeCartridge>>>;
  /**
   * Construct and simulate a get_user_cartridges transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get all cartridge IDs owned by a user
   */
  get_user_cartridges: (
    {
      user,
    }: {
      user: string;
    },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;
      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;
      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<Array<u32>>>;
  /**
   * Construct and simulate a get_total_cartridges transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get total number of cartridges minted
   */
  get_total_cartridges: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;
    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;
    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<u32>>;
  /**
   * Construct and simulate a admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get the admin address
   */
  admin: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;
    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;
    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<string>>;
  /**
   * Construct and simulate a set_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Update admin (only callable by current admin)
   */
  set_admin: (
    {
      new_admin,
    }: {
      new_admin: string;
    },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;
      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;
      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<null>>;
  /**
   * Construct and simulate a get_skin_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get number of available cartridge skins
   */
  get_skin_count: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;
    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;
    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<u64>>;
  /**
   * Construct and simulate a get_drand_public_key transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get stored drand public key (for debugging)
   */
  get_drand_public_key: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;
    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;
    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Buffer>>;
  /**
   * Construct and simulate a finalize_splice transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Force redeployment utility: comment/uncomment this function to change WASM hash
   * This triggers scaffold to redeploy and regenerate TypeScript bindings with new contract ID
   * Finalize a cartridge into a Creature NFT using drand entropy
   * User submits entropy (round, randomness, signature) which is verified inline
   */
  finalize_splice: (
    {
      cartridge_id,
      round,
      randomness,
      signature,
    }: {
      cartridge_id: u32;
      round: u64;
      randomness: Buffer;
      signature: Buffer;
    },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;
      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;
      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<u32>>;
  /**
   * Construct and simulate a get_creature transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get creature data by ID
   */
  get_creature: (
    {
      creature_id,
    }: {
      creature_id: u32;
    },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;
      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;
      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<Option<Creature>>>;
  /**
   * Construct and simulate a get_user_creatures transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get all creature IDs owned by a user
   */
  get_user_creatures: (
    {
      user,
    }: {
      user: string;
    },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;
      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;
      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<Array<u32>>>;
  /**
   * Construct and simulate a get_dev_mode transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get current dev mode status
   */
  get_dev_mode: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;
    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;
    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<boolean>>;
  /**
   * Construct and simulate a test_full_verification transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Test: Complete BLS12-381 drand signature verification with all arguments provided
   * This function accepts all parameters and performs the full verification flow
   * without relying on any stored state.
   *
   * Arguments:
   * - round: Drand round number (u64)
   * - signature: Uncompressed G1 point (96 bytes: x || y)
   * - drand_public_key: Uncompressed G2 point (192 bytes: x_c1 || x_c0 || y_c1 || y_c0)
   *
   * Returns true if verification succeeds, false otherwise
   */
  test_full_verification: (
    {
      round,
      signature,
      drand_public_key,
    }: {
      round: u64;
      signature: Buffer;
      drand_public_key: Buffer;
    },
    options?: {
      /**
       * The fee to pay for the transaction. Default: BASE_FEE
       */
      fee?: number;
      /**
       * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
       */
      timeoutInSeconds?: number;
      /**
       * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
       */
      simulate?: boolean;
    },
  ) => Promise<AssembledTransaction<boolean>>;
}
export declare class Client extends ContractClient {
  readonly options: ContractClientOptions;
  static deploy<T = Client>(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    {
      admin,
      xlm_token,
      cartridge_skin_count,
      dev_mode,
      drand_public_key,
    }: {
      admin: string;
      xlm_token: string;
      cartridge_skin_count: u64;
      dev_mode: boolean;
      drand_public_key: Buffer;
    },
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      },
  ): Promise<AssembledTransaction<T>>;
  constructor(options: ContractClientOptions);
  readonly fromJSON: {
    splice_genome: (json: string) => AssembledTransaction<number>;
    get_cartridge: (
      json: string,
    ) => AssembledTransaction<Option<GenomeCartridge>>;
    get_user_cartridges: (json: string) => AssembledTransaction<number[]>;
    get_total_cartridges: (json: string) => AssembledTransaction<number>;
    admin: (json: string) => AssembledTransaction<string>;
    set_admin: (json: string) => AssembledTransaction<null>;
    get_skin_count: (json: string) => AssembledTransaction<bigint>;
    get_drand_public_key: (
      json: string,
    ) => AssembledTransaction<Buffer<ArrayBufferLike>>;
    finalize_splice: (json: string) => AssembledTransaction<number>;
    get_creature: (json: string) => AssembledTransaction<Option<Creature>>;
    get_user_creatures: (json: string) => AssembledTransaction<number[]>;
    get_dev_mode: (json: string) => AssembledTransaction<boolean>;
    test_full_verification: (json: string) => AssembledTransaction<boolean>;
  };
}
