import { keepAlive } from "./keepAlive";
import { pinCreature } from "./pinning";

const PORT = process.env.PORT || 3001;

// Keep-alive: run every 24 hours
const KEEP_ALIVE_INTERVAL = 24 * 60 * 60 * 1000;

async function startKeepAlive() {
  console.log("[keep-alive] Running initial TTL extension...");
  try {
    await keepAlive();
    console.log("[keep-alive] Initial TTL extension complete");
  } catch (e) {
    console.error("[keep-alive] Initial TTL extension failed:", e);
  }

  setInterval(async () => {
    console.log("[keep-alive] Running scheduled TTL extension...");
    try {
      await keepAlive();
      console.log("[keep-alive] TTL extension complete");
    } catch (e) {
      console.error("[keep-alive] TTL extension failed:", e);
    }
  }, KEEP_ALIVE_INTERVAL);
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Health check
    if (url.pathname === "/health") {
      return Response.json({ status: "ok" }, { headers: corsHeaders });
    }

    // Pin creature NFT metadata + image to IPFS
    if (url.pathname === "/api/pin-creature" && req.method === "POST") {
      try {
        const body = await req.json();
        const { creatureId, headGeneId, bodyGeneId, legsGeneId, skinId } = body;

        if (
          creatureId === undefined ||
          headGeneId === undefined ||
          bodyGeneId === undefined ||
          legsGeneId === undefined ||
          skinId === undefined
        ) {
          return Response.json(
            {
              error:
                "Missing required fields: creatureId, headGeneId, bodyGeneId, legsGeneId, skinId",
            },
            { status: 400, headers: corsHeaders },
          );
        }

        const result = await pinCreature({
          creatureId,
          headGeneId,
          bodyGeneId,
          legsGeneId,
          skinId,
        });
        return Response.json(result, { headers: corsHeaders });
      } catch (e: any) {
        console.error("[pin-creature] Error:", e);
        return Response.json(
          { error: e.message || "Pinning failed" },
          { status: 500, headers: corsHeaders },
        );
      }
    }

    // Manual keep-alive trigger
    if (url.pathname === "/api/keep-alive" && req.method === "POST") {
      try {
        await keepAlive();
        return Response.json({ status: "ok" }, { headers: corsHeaders });
      } catch (e: any) {
        console.error("[keep-alive] Error:", e);
        return Response.json(
          { error: e.message || "Keep-alive failed" },
          { status: 500, headers: corsHeaders },
        );
      }
    }

    return Response.json(
      { error: "Not found" },
      { status: 404, headers: corsHeaders },
    );
  },
});

console.log(`[splicers-server] Listening on port ${server.port}`);
startKeepAlive();
