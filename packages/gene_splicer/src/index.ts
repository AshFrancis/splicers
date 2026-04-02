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
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<u32>>;

  /**
   * Construct and simulate a get_cartridge transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get cartridge data by ID
   */
  get_cartridge: (
    { cartridge_id }: { cartridge_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Option<GenomeCartridge>>>;

  /**
   * Construct and simulate a get_cartridges_batch transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get multiple cartridges by IDs in a single call
   */
  get_cartridges_batch: (
    { ids }: { ids: Array<u32> },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Array<Option<GenomeCartridge>>>>;

  /**
   * Construct and simulate a get_user_cartridges transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get all cartridge IDs owned by a user
   */
  get_user_cartridges: (
    { user }: { user: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Array<u32>>>;

  /**
   * Construct and simulate a get_total_cartridges transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get total number of cartridges minted
   */
  get_total_cartridges: (
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<u32>>;

  /**
   * Construct and simulate a admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get the admin address
   */
  admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>;

  /**
   * Construct and simulate a set_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Update admin (only callable by current admin)
   */
  set_admin: (
    { new_admin }: { new_admin: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a set_skin_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Update cartridge skin count (admin-only)
   */
  set_skin_count: (
    { new_count }: { new_count: u64 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a set_drand_public_key transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Update drand public key (admin-only, 192 bytes uncompressed G2)
   */
  set_drand_public_key: (
    { new_key }: { new_key: Buffer },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a get_skin_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get number of available cartridge skins
   */
  get_skin_count: (
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<u64>>;

  /**
   * Construct and simulate a get_drand_public_key transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get stored drand public key
   */
  get_drand_public_key: (
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Buffer>>;

  /**
   * Construct and simulate a finalize_splice transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Finalize a cartridge into a Creature NFT using drand entropy
   * User submits entropy (round, randomness, signature) which is verified inline
   */
  finalize_splice: (
    {
      cartridge_id,
      round,
      randomness,
      signature_compressed,
      signature_uncompressed,
    }: {
      cartridge_id: u32;
      round: u64;
      randomness: Buffer;
      signature_compressed: Buffer;
      signature_uncompressed: Buffer;
    },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<u32>>;

  /**
   * Construct and simulate a get_creature transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get creature data by ID
   */
  get_creature: (
    { creature_id }: { creature_id: u32 },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Option<Creature>>>;

  /**
   * Construct and simulate a get_creatures_batch transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get multiple creatures by IDs in a single call
   */
  get_creatures_batch: (
    { ids }: { ids: Array<u32> },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Array<Option<Creature>>>>;

  /**
   * Construct and simulate a get_user_creatures transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get all creature IDs owned by a user
   */
  get_user_creatures: (
    { user }: { user: string },
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<Array<u32>>>;

  /**
   * Construct and simulate a extend_ttl transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Extend TTL for the contract instance and WASM code
   * This is permissionless - anyone can keep the contract alive
   */
  extend_ttl: (options?: MethodOptions) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a get_dev_mode transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get current dev mode status
   */
  get_dev_mode: (
    options?: MethodOptions,
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
        "AAAAAQAAADlDcmVhdHVyZSBORlQgLSBmaW5hbCBmb3JtIGFmdGVyIGZpbmFsaXphdGlvbiB3aXRoIGVudHJvcHkAAAAAAAAAAAAACENyZWF0dXJlAAAACAAAAAAAAAAJYm9keV9nZW5lAAAAAAAH0AAAAARHZW5lAAAAAAAAAA1lbnRyb3B5X3JvdW5kAAAAAAAABgAAAAAAAAAMZmluYWxpemVkX2F0AAAABgAAAAAAAAAJaGVhZF9nZW5lAAAAAAAH0AAAAARHZW5lAAAAAAAAAAJpZAAAAAAABAAAAAAAAAAJbGVnc19nZW5lAAAAAAAH0AAAAARHZW5lAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAAB3NraW5faWQAAAAABA==",
        "AAAAAgAAAB1TdG9yYWdlIGtleXMgZm9yIHRoZSBjb250cmFjdAAAAAAAAAAAAAAHRGF0YUtleQAAAAAKAAAAAAAAAAAAAAAFQWRtaW4AAAAAAAAAAAAAAAAAAAhYbG1Ub2tlbgAAAAAAAAAAAAAAEkNhcnRyaWRnZVNraW5Db3VudAAAAAAAAAAAAAAAAAAPTmV4dENhcnRyaWRnZUlkAAAAAAEAAAAAAAAACUNhcnRyaWRnZQAAAAAAAAEAAAAEAAAAAQAAAAAAAAAOVXNlckNhcnRyaWRnZXMAAAAAAAEAAAATAAAAAQAAAAAAAAAIQ3JlYXR1cmUAAAABAAAABAAAAAEAAAAAAAAADVVzZXJDcmVhdHVyZXMAAAAAAAABAAAAEwAAAAAAAAAAAAAAB0Rldk1vZGUAAAAAAAAAAAAAAAAORHJhbmRQdWJsaWNLZXkAAA==",
        "AAAABQAAAChFdmVudCBlbWl0dGVkIHdoZW4gYSBjYXJ0cmlkZ2UgaXMgbWludGVkAAAAAAAAAA9DYXJ0cmlkZ2VNaW50ZWQAAAAAAQAAABBjYXJ0cmlkZ2VfbWludGVkAAAAAwAAAAAAAAAMY2FydHJpZGdlX2lkAAAABAAAAAAAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAAAAAAB3NraW5faWQAAAAABAAAAAAAAAAC",
        "AAAABQAAACpFdmVudCBlbWl0dGVkIHdoZW4gYSBjcmVhdHVyZSBpcyBmaW5hbGl6ZWQAAAAAAAAAAAARQ3JlYXR1cmVGaW5hbGl6ZWQAAAAAAAABAAAAEmNyZWF0dXJlX2ZpbmFsaXplZAAAAAAABAAAAAAAAAAMY2FydHJpZGdlX2lkAAAABAAAAAAAAAAAAAAADGhlYWRfZ2VuZV9pZAAAAAQAAAAAAAAAAAAAAAxib2R5X2dlbmVfaWQAAAAEAAAAAAAAAAAAAAAMbGVnc19nZW5lX2lkAAAABAAAAAAAAAAC",
        "AAAAAAAAANtDb25zdHJ1Y3RvciAtIHJ1bnMgYXV0b21hdGljYWxseSBkdXJpbmcgY29udHJhY3QgZGVwbG95bWVudApDQVAtMDA1ODogaHR0cHM6Ly9naXRodWIuY29tL3N0ZWxsYXIvc3RlbGxhci1wcm90b2NvbC9ibG9iL21hc3Rlci9jb3JlL2NhcC0wMDU4Lm1kCk5vdGU6IGRldl9tb2RlIHNob3VsZCBiZSBmYWxzZSBpbiBwcm9kdWN0aW9uIGZvciBmdWxsIEJMUzEyLTM4MSB2ZXJpZmljYXRpb24AAAAADV9fY29uc3RydWN0b3IAAAAAAAAFAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAACXhsbV90b2tlbgAAAAAAABMAAAAAAAAAFGNhcnRyaWRnZV9za2luX2NvdW50AAAABgAAAAAAAAAIZGV2X21vZGUAAAABAAAAAAAAABBkcmFuZF9wdWJsaWNfa2V5AAAADgAAAAA=",
        "AAAAAAAAAL5NaW50IGEgbmV3IEdlbm9tZSBDYXJ0cmlkZ2UgTkZUCi0gVHJhbnNmZXJzIDEgWExNIGZlZSBmcm9tIHVzZXIgdG8gYWRtaW4KLSBVc2VzIFBSTkcgdG8gc2VsZWN0IHJhbmRvbSBjYXJ0cmlkZ2Ugc2tpbgotIE1pbnRzIGNhcnRyaWRnZSBORlQgd2l0aCBhc3NpZ25lZCBzcGxpY2Vfcm91bmQKUmV0dXJucyB0aGUgY2FydHJpZGdlIElEAAAAAAANc3BsaWNlX2dlbm9tZQAAAAAAAAEAAAAAAAAABHVzZXIAAAATAAAAAQAAAAQ=",
        "AAAAAAAAABhHZXQgY2FydHJpZGdlIGRhdGEgYnkgSUQAAAANZ2V0X2NhcnRyaWRnZQAAAAAAAAEAAAAAAAAADGNhcnRyaWRnZV9pZAAAAAQAAAABAAAD6AAAB9AAAAAPR2Vub21lQ2FydHJpZGdlAA==",
        "AAAAAAAAAC9HZXQgbXVsdGlwbGUgY2FydHJpZGdlcyBieSBJRHMgaW4gYSBzaW5nbGUgY2FsbAAAAAAUZ2V0X2NhcnRyaWRnZXNfYmF0Y2gAAAABAAAAAAAAAANpZHMAAAAD6gAAAAQAAAABAAAD6gAAA+gAAAfQAAAAD0dlbm9tZUNhcnRyaWRnZQA=",
        "AAAAAAAAACVHZXQgYWxsIGNhcnRyaWRnZSBJRHMgb3duZWQgYnkgYSB1c2VyAAAAAAAAE2dldF91c2VyX2NhcnRyaWRnZXMAAAAAAQAAAAAAAAAEdXNlcgAAABMAAAABAAAD6gAAAAQ=",
        "AAAAAAAAACVHZXQgdG90YWwgbnVtYmVyIG9mIGNhcnRyaWRnZXMgbWludGVkAAAAAAAAFGdldF90b3RhbF9jYXJ0cmlkZ2VzAAAAAAAAAAEAAAAE",
        "AAAAAAAAABVHZXQgdGhlIGFkbWluIGFkZHJlc3MAAAAAAAAFYWRtaW4AAAAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAC1VcGRhdGUgYWRtaW4gKG9ubHkgY2FsbGFibGUgYnkgY3VycmVudCBhZG1pbikAAAAAAAAJc2V0X2FkbWluAAAAAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAA=",
        "AAAAAAAAAChVcGRhdGUgY2FydHJpZGdlIHNraW4gY291bnQgKGFkbWluLW9ubHkpAAAADnNldF9za2luX2NvdW50AAAAAAABAAAAAAAAAAluZXdfY291bnQAAAAAAAAGAAAAAA==",
        "AAAAAAAAAD9VcGRhdGUgZHJhbmQgcHVibGljIGtleSAoYWRtaW4tb25seSwgMTkyIGJ5dGVzIHVuY29tcHJlc3NlZCBHMikAAAAAFHNldF9kcmFuZF9wdWJsaWNfa2V5AAAAAQAAAAAAAAAHbmV3X2tleQAAAAAOAAAAAA==",
        "AAAAAAAAACdHZXQgbnVtYmVyIG9mIGF2YWlsYWJsZSBjYXJ0cmlkZ2Ugc2tpbnMAAAAADmdldF9za2luX2NvdW50AAAAAAAAAAAAAQAAAAY=",
        "AAAAAAAAABtHZXQgc3RvcmVkIGRyYW5kIHB1YmxpYyBrZXkAAAAAFGdldF9kcmFuZF9wdWJsaWNfa2V5AAAAAAAAAAEAAAAO",
        "AAAAAAAAAIlGaW5hbGl6ZSBhIGNhcnRyaWRnZSBpbnRvIGEgQ3JlYXR1cmUgTkZUIHVzaW5nIGRyYW5kIGVudHJvcHkKVXNlciBzdWJtaXRzIGVudHJvcHkgKHJvdW5kLCByYW5kb21uZXNzLCBzaWduYXR1cmUpIHdoaWNoIGlzIHZlcmlmaWVkIGlubGluZQAAAAAAAA9maW5hbGl6ZV9zcGxpY2UAAAAABQAAAAAAAAAMY2FydHJpZGdlX2lkAAAABAAAAAAAAAAFcm91bmQAAAAAAAAGAAAAAAAAAApyYW5kb21uZXNzAAAAAAAOAAAAAAAAABRzaWduYXR1cmVfY29tcHJlc3NlZAAAAA4AAAAAAAAAFnNpZ25hdHVyZV91bmNvbXByZXNzZWQAAAAAAA4AAAABAAAABA==",
        "AAAAAAAAABdHZXQgY3JlYXR1cmUgZGF0YSBieSBJRAAAAAAMZ2V0X2NyZWF0dXJlAAAAAQAAAAAAAAALY3JlYXR1cmVfaWQAAAAABAAAAAEAAAPoAAAH0AAAAAhDcmVhdHVyZQ==",
        "AAAAAAAAAC5HZXQgbXVsdGlwbGUgY3JlYXR1cmVzIGJ5IElEcyBpbiBhIHNpbmdsZSBjYWxsAAAAAAATZ2V0X2NyZWF0dXJlc19iYXRjaAAAAAABAAAAAAAAAANpZHMAAAAD6gAAAAQAAAABAAAD6gAAA+gAAAfQAAAACENyZWF0dXJl",
        "AAAAAAAAACRHZXQgYWxsIGNyZWF0dXJlIElEcyBvd25lZCBieSBhIHVzZXIAAAASZ2V0X3VzZXJfY3JlYXR1cmVzAAAAAAABAAAAAAAAAAR1c2VyAAAAEwAAAAEAAAPqAAAABA==",
        "AAAAAAAAAG5FeHRlbmQgVFRMIGZvciB0aGUgY29udHJhY3QgaW5zdGFuY2UgYW5kIFdBU00gY29kZQpUaGlzIGlzIHBlcm1pc3Npb25sZXNzIC0gYW55b25lIGNhbiBrZWVwIHRoZSBjb250cmFjdCBhbGl2ZQAAAAAACmV4dGVuZF90dGwAAAAAAAAAAAAA",
        "AAAAAAAAABtHZXQgY3VycmVudCBkZXYgbW9kZSBzdGF0dXMAAAAADGdldF9kZXZfbW9kZQAAAAAAAAABAAAAAQ==",
      ]),
      options,
    );
  }
  public readonly fromJSON = {
    splice_genome: this.txFromJSON<u32>,
    get_cartridge: this.txFromJSON<Option<GenomeCartridge>>,
    get_cartridges_batch: this.txFromJSON<Array<Option<GenomeCartridge>>>,
    get_user_cartridges: this.txFromJSON<Array<u32>>,
    get_total_cartridges: this.txFromJSON<u32>,
    admin: this.txFromJSON<string>,
    set_admin: this.txFromJSON<null>,
    set_skin_count: this.txFromJSON<null>,
    set_drand_public_key: this.txFromJSON<null>,
    get_skin_count: this.txFromJSON<u64>,
    get_drand_public_key: this.txFromJSON<Buffer>,
    finalize_splice: this.txFromJSON<u32>,
    get_creature: this.txFromJSON<Option<Creature>>,
    get_creatures_batch: this.txFromJSON<Array<Option<Creature>>>,
    get_user_creatures: this.txFromJSON<Array<u32>>,
    extend_ttl: this.txFromJSON<null>,
    get_dev_mode: this.txFromJSON<boolean>,
  };
}
