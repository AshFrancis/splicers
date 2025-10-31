import React from "react";
import { Code, Layout, Text } from "@stellar/design-system";

const Home: React.FC = () => (
  <Layout.Content>
    <Layout.Inset>
      <Text as="h1" size="xl">
        Gene Splicer
      </Text>
      <Text as="p" size="md">
        Welcome to Gene Splicer - a Stellar NFT game where you splice gene
        segments to create unique creatures.
      </Text>

      <Text as="h2" size="lg">
        How to Play
      </Text>
      <Text as="p" size="md">
        1. <strong>Splice Genome:</strong> Pay 1 XLM to mint a Genome Cartridge
        NFT with a random cosmetic skin
      </Text>
      <Text as="p" size="md">
        2. <strong>Wait for Entropy:</strong> Drand randomness is submitted to
        determine your creature's genes
      </Text>
      <Text as="p" size="md">
        3. <strong>Finalize:</strong> Transform your cartridge into a unique
        Creature NFT with head, torso, and leg genes
      </Text>

      <Text as="h2" size="lg">
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
          <Code size="md">splice_genome(user)</Code> - Mint a new cartridge
        </li>
        <li>
          <Code size="md">get_cartridge(id)</Code> - View cartridge data
        </li>
        <li>
          <Code size="md">get_user_cartridges(user)</Code> - List user's
          cartridges
        </li>
      </ul>

      <Text as="h2" size="lg">
        Resources
      </Text>
      <Text as="p" size="md">
        Game specification:{" "}
        <Code size="md">/docs/specs/gene-splicing-v1.md</Code>
      </Text>
    </Layout.Inset>
  </Layout.Content>
);

export default Home;
