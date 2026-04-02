const CONTRACT_ID = process.env.CONTRACT_ID;
if (!CONTRACT_ID) {
  throw new Error("CONTRACT_ID environment variable is required");
}
const NETWORK = process.env.STELLAR_NETWORK || "testnet";

export async function keepAlive() {
  const stellarBin = process.env.STELLAR_BIN || "/root/.cargo/bin/stellar";
  const proc = Bun.spawn(
    [
      stellarBin,
      "contract",
      "invoke",
      "--id",
      CONTRACT_ID,
      "--network",
      NETWORK,
      "--source",
      "splicers-server",
      "--send=yes",
      "--",
      "extend_ttl",
    ],
    { stdout: "pipe", stderr: "pipe" },
  );

  const exitCode = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();

  if (exitCode !== 0) {
    throw new Error(`stellar CLI failed (exit ${exitCode}): ${stderr}`);
  }

  console.log("[keep-alive] stdout:", stdout.trim());
  return { success: true };
}
