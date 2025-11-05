import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Typepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}

export const networks = {
  standalone: {
    networkPassphrase: "Standalone Network ; February 2017",
    contractId: "CB7PGTVTZFYMDXDPFIVIQINM6B5E5PQ545Z5OW4X2A6Z3KLI6SFSLHMT",
  },
} as const;

/**
 * Gene rarity levels (affects visual appearance and value)
 */
export type GeneRarity =
  | { tag: "Normal"; values: void }
  | { tag: "Rare"; values: void }
  | { tag: "Legendary"; values: void };

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
  entropy_round: u64;
  finalized_at: u64;
  head_gene: Gene;
  id: u32;
  legs_gene: Gene;
  owner: string;
  skin_id: u32;
  torso_gene: Gene;
}

/**
 * Storage keys for the contract
 */
export type DataKey =
  | { tag: "Admin"; values: void }
  | { tag: "XlmToken"; values: void }
  | { tag: "CartridgeSkinCount"; values: void }
  | { tag: "NextCartridgeId"; values: void }
  | { tag: "Cartridge"; values: readonly [u32] }
  | { tag: "UserCartridges"; values: readonly [string] }
  | { tag: "Creature"; values: readonly [u32] }
  | { tag: "UserCreatures"; values: readonly [string] }
  | { tag: "DevMode"; values: void }
  | { tag: "DrandPublicKey"; values: void };

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
    { user }: { user: string },
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
    { cartridge_id }: { cartridge_id: u32 },
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
    { user }: { user: string },
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
    { new_admin }: { new_admin: string },
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
    }: { cartridge_id: u32; round: u64; randomness: Buffer; signature: Buffer },
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
    { creature_id }: { creature_id: u32 },
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
    { user }: { user: string },
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
    }: { round: u64; signature: Buffer; drand_public_key: Buffer },
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
export class Client extends ContractClient {
  static async deploy<T = Client>(
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
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(
      { admin, xlm_token, cartridge_skin_count, dev_mode, drand_public_key },
      options,
    );
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([
        "AAAAAgAAADhHZW5lIHJhcml0eSBsZXZlbHMgKGFmZmVjdHMgdmlzdWFsIGFwcGVhcmFuY2UgYW5kIHZhbHVlKQAAAAAAAAAKR2VuZVJhcml0eQAAAAAAAwAAAAAAAAAAAAAABk5vcm1hbAAAAAAAAAAAAAAAAAAEUmFyZQAAAAAAAAAAAAAACUxlZ2VuZGFyeQAAAA==",
        "AAAAAQAAACJJbmRpdmlkdWFsIGdlbmUgd2l0aCBJRCBhbmQgcmFyaXR5AAAAAAAAAAAABEdlbmUAAAACAAAAAAAAAAJpZAAAAAAABAAAAAAAAAAGcmFyaXR5AAAAAAfQAAAACkdlbmVSYXJpdHkAAA==",
        "AAAAAQAAAERHZW5vbWUgQ2FydHJpZGdlIE5GVCAtIG1pbnRlZCB3aGVuIHVzZXIgc3BsaWNlcywgYmVmb3JlIGZpbmFsaXphdGlvbgAAAAAAAAAPR2Vub21lQ2FydHJpZGdlAAAAAAYAAAAAAAAACmNyZWF0ZWRfYXQAAAAAAAYAAAAAAAAACWZpbmFsaXplZAAAAAAAAAEAAAAAAAAAAmlkAAAAAAAEAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAAB3NraW5faWQAAAAABAAAAAAAAAAMc3BsaWNlX3JvdW5kAAAABg==",
        "AAAAAQAAADlDcmVhdHVyZSBORlQgLSBmaW5hbCBmb3JtIGFmdGVyIGZpbmFsaXphdGlvbiB3aXRoIGVudHJvcHkAAAAAAAAAAAAACENyZWF0dXJlAAAACAAAAAAAAAANZW50cm9weV9yb3VuZAAAAAAAAAYAAAAAAAAADGZpbmFsaXplZF9hdAAAAAYAAAAAAAAACWhlYWRfZ2VuZQAAAAAAB9AAAAAER2VuZQAAAAAAAAACaWQAAAAAAAQAAAAAAAAACWxlZ3NfZ2VuZQAAAAAAB9AAAAAER2VuZQAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAdza2luX2lkAAAAAAQAAAAAAAAACnRvcnNvX2dlbmUAAAAAB9AAAAAER2VuZQ==",
        "AAAAAgAAAB1TdG9yYWdlIGtleXMgZm9yIHRoZSBjb250cmFjdAAAAAAAAAAAAAAHRGF0YUtleQAAAAAKAAAAAAAAAAAAAAAFQWRtaW4AAAAAAAAAAAAAAAAAAAhYbG1Ub2tlbgAAAAAAAAAAAAAAEkNhcnRyaWRnZVNraW5Db3VudAAAAAAAAAAAAAAAAAAPTmV4dENhcnRyaWRnZUlkAAAAAAEAAAAAAAAACUNhcnRyaWRnZQAAAAAAAAEAAAAEAAAAAQAAAAAAAAAOVXNlckNhcnRyaWRnZXMAAAAAAAEAAAATAAAAAQAAAAAAAAAIQ3JlYXR1cmUAAAABAAAABAAAAAEAAAAAAAAADVVzZXJDcmVhdHVyZXMAAAAAAAABAAAAEwAAAAAAAAAAAAAAB0Rldk1vZGUAAAAAAAAAAAAAAAAORHJhbmRQdWJsaWNLZXkAAA==",
        "AAAABQAAAChFdmVudCBlbWl0dGVkIHdoZW4gYSBjYXJ0cmlkZ2UgaXMgbWludGVkAAAAAAAAAA9DYXJ0cmlkZ2VNaW50ZWQAAAAAAQAAABBjYXJ0cmlkZ2VfbWludGVkAAAAAwAAAAAAAAAMY2FydHJpZGdlX2lkAAAABAAAAAAAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAAAAAAB3NraW5faWQAAAAABAAAAAAAAAAC",
        "AAAABQAAACpFdmVudCBlbWl0dGVkIHdoZW4gYSBjcmVhdHVyZSBpcyBmaW5hbGl6ZWQAAAAAAAAAAAARQ3JlYXR1cmVGaW5hbGl6ZWQAAAAAAAABAAAAEmNyZWF0dXJlX2ZpbmFsaXplZAAAAAAABAAAAAAAAAAMY2FydHJpZGdlX2lkAAAABAAAAAAAAAAAAAAADGhlYWRfZ2VuZV9pZAAAAAQAAAAAAAAAAAAAAA10b3Jzb19nZW5lX2lkAAAAAAAABAAAAAAAAAAAAAAADGxlZ3NfZ2VuZV9pZAAAAAQAAAAAAAAAAg==",
        "AAAAAAAAANtDb25zdHJ1Y3RvciAtIHJ1bnMgYXV0b21hdGljYWxseSBkdXJpbmcgY29udHJhY3QgZGVwbG95bWVudApDQVAtMDA1ODogaHR0cHM6Ly9naXRodWIuY29tL3N0ZWxsYXIvc3RlbGxhci1wcm90b2NvbC9ibG9iL21hc3Rlci9jb3JlL2NhcC0wMDU4Lm1kCk5vdGU6IGRldl9tb2RlIHNob3VsZCBiZSBmYWxzZSBpbiBwcm9kdWN0aW9uIGZvciBmdWxsIEJMUzEyLTM4MSB2ZXJpZmljYXRpb24AAAAADV9fY29uc3RydWN0b3IAAAAAAAAFAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAACXhsbV90b2tlbgAAAAAAABMAAAAAAAAAFGNhcnRyaWRnZV9za2luX2NvdW50AAAABgAAAAAAAAAIZGV2X21vZGUAAAABAAAAAAAAABBkcmFuZF9wdWJsaWNfa2V5AAAADgAAAAA=",
        "AAAAAAAAAL5NaW50IGEgbmV3IEdlbm9tZSBDYXJ0cmlkZ2UgTkZUCi0gVHJhbnNmZXJzIDEgWExNIGZlZSBmcm9tIHVzZXIgdG8gYWRtaW4KLSBVc2VzIFBSTkcgdG8gc2VsZWN0IHJhbmRvbSBjYXJ0cmlkZ2Ugc2tpbgotIE1pbnRzIGNhcnRyaWRnZSBORlQgd2l0aCBhc3NpZ25lZCBzcGxpY2Vfcm91bmQKUmV0dXJucyB0aGUgY2FydHJpZGdlIElEAAAAAAANc3BsaWNlX2dlbm9tZQAAAAAAAAEAAAAAAAAABHVzZXIAAAATAAAAAQAAAAQ=",
        "AAAAAAAAABhHZXQgY2FydHJpZGdlIGRhdGEgYnkgSUQAAAANZ2V0X2NhcnRyaWRnZQAAAAAAAAEAAAAAAAAADGNhcnRyaWRnZV9pZAAAAAQAAAABAAAD6AAAB9AAAAAPR2Vub21lQ2FydHJpZGdlAA==",
        "AAAAAAAAACVHZXQgYWxsIGNhcnRyaWRnZSBJRHMgb3duZWQgYnkgYSB1c2VyAAAAAAAAE2dldF91c2VyX2NhcnRyaWRnZXMAAAAAAQAAAAAAAAAEdXNlcgAAABMAAAABAAAD6gAAAAQ=",
        "AAAAAAAAACVHZXQgdG90YWwgbnVtYmVyIG9mIGNhcnRyaWRnZXMgbWludGVkAAAAAAAAFGdldF90b3RhbF9jYXJ0cmlkZ2VzAAAAAAAAAAEAAAAE",
        "AAAAAAAAABVHZXQgdGhlIGFkbWluIGFkZHJlc3MAAAAAAAAFYWRtaW4AAAAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAC1VcGRhdGUgYWRtaW4gKG9ubHkgY2FsbGFibGUgYnkgY3VycmVudCBhZG1pbikAAAAAAAAJc2V0X2FkbWluAAAAAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAA=",
        "AAAAAAAAACdHZXQgbnVtYmVyIG9mIGF2YWlsYWJsZSBjYXJ0cmlkZ2Ugc2tpbnMAAAAADmdldF9za2luX2NvdW50AAAAAAAAAAAAAQAAAAY=",
        "AAAAAAAAACtHZXQgc3RvcmVkIGRyYW5kIHB1YmxpYyBrZXkgKGZvciBkZWJ1Z2dpbmcpAAAAABRnZXRfZHJhbmRfcHVibGljX2tleQAAAAAAAAABAAAADg==",
        "AAAAAAAAATRGb3JjZSByZWRlcGxveW1lbnQgdXRpbGl0eTogY29tbWVudC91bmNvbW1lbnQgdGhpcyBmdW5jdGlvbiB0byBjaGFuZ2UgV0FTTSBoYXNoClRoaXMgdHJpZ2dlcnMgc2NhZmZvbGQgdG8gcmVkZXBsb3kgYW5kIHJlZ2VuZXJhdGUgVHlwZVNjcmlwdCBiaW5kaW5ncyB3aXRoIG5ldyBjb250cmFjdCBJRApGaW5hbGl6ZSBhIGNhcnRyaWRnZSBpbnRvIGEgQ3JlYXR1cmUgTkZUIHVzaW5nIGRyYW5kIGVudHJvcHkKVXNlciBzdWJtaXRzIGVudHJvcHkgKHJvdW5kLCByYW5kb21uZXNzLCBzaWduYXR1cmUpIHdoaWNoIGlzIHZlcmlmaWVkIGlubGluZQAAAA9maW5hbGl6ZV9zcGxpY2UAAAAABAAAAAAAAAAMY2FydHJpZGdlX2lkAAAABAAAAAAAAAAFcm91bmQAAAAAAAAGAAAAAAAAAApyYW5kb21uZXNzAAAAAAAOAAAAAAAAAAlzaWduYXR1cmUAAAAAAAAOAAAAAQAAAAQ=",
        "AAAAAAAAABdHZXQgY3JlYXR1cmUgZGF0YSBieSBJRAAAAAAMZ2V0X2NyZWF0dXJlAAAAAQAAAAAAAAALY3JlYXR1cmVfaWQAAAAABAAAAAEAAAPoAAAH0AAAAAhDcmVhdHVyZQ==",
        "AAAAAAAAACRHZXQgYWxsIGNyZWF0dXJlIElEcyBvd25lZCBieSBhIHVzZXIAAAASZ2V0X3VzZXJfY3JlYXR1cmVzAAAAAAABAAAAAAAAAAR1c2VyAAAAEwAAAAEAAAPqAAAABA==",
        "AAAAAAAAABtHZXQgY3VycmVudCBkZXYgbW9kZSBzdGF0dXMAAAAADGdldF9kZXZfbW9kZQAAAAAAAAABAAAAAQ==",
        "AAAAAAAAAbNUZXN0OiBDb21wbGV0ZSBCTFMxMi0zODEgZHJhbmQgc2lnbmF0dXJlIHZlcmlmaWNhdGlvbiB3aXRoIGFsbCBhcmd1bWVudHMgcHJvdmlkZWQKVGhpcyBmdW5jdGlvbiBhY2NlcHRzIGFsbCBwYXJhbWV0ZXJzIGFuZCBwZXJmb3JtcyB0aGUgZnVsbCB2ZXJpZmljYXRpb24gZmxvdwp3aXRob3V0IHJlbHlpbmcgb24gYW55IHN0b3JlZCBzdGF0ZS4KCkFyZ3VtZW50czoKLSByb3VuZDogRHJhbmQgcm91bmQgbnVtYmVyICh1NjQpCi0gc2lnbmF0dXJlOiBVbmNvbXByZXNzZWQgRzEgcG9pbnQgKDk2IGJ5dGVzOiB4IHx8IHkpCi0gZHJhbmRfcHVibGljX2tleTogVW5jb21wcmVzc2VkIEcyIHBvaW50ICgxOTIgYnl0ZXM6IHhfYzEgfHwgeF9jMCB8fCB5X2MxIHx8IHlfYzApCgpSZXR1cm5zIHRydWUgaWYgdmVyaWZpY2F0aW9uIHN1Y2NlZWRzLCBmYWxzZSBvdGhlcndpc2UAAAAAFnRlc3RfZnVsbF92ZXJpZmljYXRpb24AAAAAAAMAAAAAAAAABXJvdW5kAAAAAAAABgAAAAAAAAAJc2lnbmF0dXJlAAAAAAAADgAAAAAAAAAQZHJhbmRfcHVibGljX2tleQAAAA4AAAABAAAAAQ==",
      ]),
      options,
    );
  }
  public readonly fromJSON = {
    splice_genome: this.txFromJSON<u32>,
    get_cartridge: this.txFromJSON<Option<GenomeCartridge>>,
    get_user_cartridges: this.txFromJSON<Array<u32>>,
    get_total_cartridges: this.txFromJSON<u32>,
    admin: this.txFromJSON<string>,
    set_admin: this.txFromJSON<null>,
    get_skin_count: this.txFromJSON<u64>,
    get_drand_public_key: this.txFromJSON<Buffer>,
    finalize_splice: this.txFromJSON<u32>,
    get_creature: this.txFromJSON<Option<Creature>>,
    get_user_creatures: this.txFromJSON<Array<u32>>,
    get_dev_mode: this.txFromJSON<boolean>,
    test_full_verification: this.txFromJSON<boolean>,
  };
}
