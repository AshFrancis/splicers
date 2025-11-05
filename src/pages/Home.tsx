import React from "react";
import { Card, Code, Layout, Text } from "@stellar/design-system";
import { GenomeSplicer } from "../components/GenomeSplicer";
import ErrorBoundary from "../components/ErrorBoundary";

const Home: React.FC = () => (
  <Layout.Content>
    <Layout.Inset>
      <Text as="h1" size="xl">
        Welcome to Splicers
      </Text>
      <Text as="p" size="md">
        The surface world is lost. In subterranean bunkers, survivors fuse genes
        and print monsters — the ultimate fighters, born to reclaim the world
        that once was.
      </Text>

      <ErrorBoundary>
        <GenomeSplicer />
      </ErrorBoundary>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          marginTop: "1rem",
          marginBottom: "4rem",
        }}
      >
        <Card variant="primary">
          <Text as="h3" size="lg" style={{ marginBottom: "1.5rem" }}>
            How to Play
          </Text>
          <Text as="p" size="md">
            1. <strong>Splice Genome:</strong> Pay 1 XLM to mint a Genome
            Cartridge NFT with a random cosmetic skin
          </Text>
          <Text as="p" size="md">
            2. <strong>Wait for Entropy:</strong> Drand randomness is submitted
            to determine your creature's genes
          </Text>
          <Text as="p" size="md">
            3. <strong>Finalize:</strong> Transform your cartridge into a unique
            Creature NFT with head, body, and leg genes
          </Text>
          <Text as="p" size="md">
            4. <strong>Battle:</strong> Battle your creature against NPCs
            (player battles coming soon!)
          </Text>
        </Card>

        <Card variant="primary">
          <Text as="h3" size="lg">
            Development
          </Text>
          <Text as="p" size="md">
            The game contract is currently under development. Check out the{" "}
            <Code size="md">&lt;/&gt; Debugger</Code> to interact with the
            gene-splicer contract directly.
          </Text>

          <Text as="p" size="md">
            Contract functions available:
          </Text>
          <ul>
            <li>
              <Code size="md">splice_genome(user)</Code> - Pay 1 XLM to mint a
              new Genome Cartridge NFT with random skin
            </li>
            <li>
              <Code size="md">finalize_splice(cartridge_id)</Code> - Transform
              cartridge into a Creature NFT using drand entropy
            </li>
            <li>
              <Code size="md">get_cartridge(id)</Code> - View cartridge data
              (owner, skin, splice round, finalized status)
            </li>
            <li>
              <Code size="md">get_creature(id)</Code> - View creature data
              (genes, rarity, owner)
            </li>
            <li>
              <Code size="md">get_user_cartridges(user)</Code> - List all
              cartridge IDs owned by a user
            </li>
            <li>
              <Code size="md">get_user_creatures(user)</Code> - List all
              creature IDs owned by a user
            </li>
            <li>
              <Code size="md">get_total_cartridges()</Code> - Get total number
              of cartridges minted
            </li>
            <li>
              <Code size="md">admin()</Code> - View current contract admin
              address
            </li>
            <li>
              <Code size="md">get_dev_mode()</Code> - Check if contract is in
              development mode
            </li>
            <li>
              <Code size="md">get_drand_public_key()</Code> - View stored drand
              public key for BLS12-381 verification
            </li>
            <li>
              <Code size="md">get_skin_count()</Code> - Get total number of
              available cosmetic skins
            </li>
            <li>
              <Code size="md">test_full_verification(round, sig, pubkey)</Code>{" "}
              - Test BLS12-381 signature verification with live drand data
            </li>
          </ul>
        </Card>

        <Card variant="primary">
          <Text as="h3" size="lg">
            Resources
          </Text>
          <Text as="p" size="md">
            Game specification:{" "}
            <Code size="md">/docs/specs/gene-splicing-v1.1.md</Code>
          </Text>
        </Card>
      </div>
    </Layout.Inset>
  </Layout.Content>
);

export default Home;
