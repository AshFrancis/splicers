import { keepAlive } from "./keepAlive";
import { pinCreature } from "./pinning";

const PORT = process.env.PORT || 3001;

// Keep-alive: run every 24 hours
const KEEP_ALIVE_INTERVAL = 24 * 60 * 60 * 1000;

// Rate limiting: per-IP request tracking
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX_PIN = 10; // 10 pin requests per minute
const RATE_LIMIT_MAX_KEEPALIVE = 1; // 1 keep-alive per minute

function isRateLimited(ip: string, max: number): boolean {
  const now = Date.now();
  const key = `${ip}`;
  const entry = rateLimits.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > max;
}

// Clean up stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimits) {
    if (now > entry.resetAt) rateLimits.delete(key);
  }
}, 5 * 60_000);

function validatePinInput(
  body: unknown,
):
  | {
      valid: true;
      data: {
        creatureId: number;
        headGeneId: number;
        bodyGeneId: number;
        legsGeneId: number;
        skinId: number;
      };
    }
  | { valid: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const { creatureId, headGeneId, bodyGeneId, legsGeneId, skinId } =
    body as Record<string, unknown>;

  for (const [name, value] of Object.entries({
    creatureId,
    headGeneId,
    bodyGeneId,
    legsGeneId,
    skinId,
  })) {
    if (value === undefined || value === null) {
      return { valid: false, error: `Missing required field: ${name}` };
    }
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      return { valid: false, error: `${name} must be a non-negative integer` };
    }
  }

  const geneIds = {
    headGeneId: headGeneId as number,
    bodyGeneId: bodyGeneId as number,
    legsGeneId: legsGeneId as number,
  };
  for (const [name, value] of Object.entries(geneIds)) {
    if (value > 14) {
      return { valid: false, error: `${name} must be between 0 and 14` };
    }
  }

  return {
    valid: true,
    data: {
      creatureId: creatureId as number,
      headGeneId: headGeneId as number,
      bodyGeneId: bodyGeneId as number,
      legsGeneId: legsGeneId as number,
      skinId: skinId as number,
    },
  };
}

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
    const clientIp =
      req.headers.get("X-Real-IP") ||
      req.headers.get("X-Forwarded-For") ||
      "unknown";

    // CORS headers — restrict to frontend origin
    const allowedOrigins = ["https://splicers.net", "http://localhost:5173"];
    const origin = req.headers.get("Origin") || "";
    const corsOrigin = allowedOrigins.includes(origin)
      ? origin
      : allowedOrigins[0];
    const corsHeaders = {
      "Access-Control-Allow-Origin": corsOrigin,
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
      if (isRateLimited(clientIp, RATE_LIMIT_MAX_PIN)) {
        return Response.json(
          { error: "Rate limit exceeded. Try again later." },
          { status: 429, headers: corsHeaders },
        );
      }

      try {
        const body = await req.json();
        const validation = validatePinInput(body);
        if (!validation.valid) {
          return Response.json(
            { error: validation.error },
            { status: 400, headers: corsHeaders },
          );
        }

        const result = await pinCreature(validation.data);
        return Response.json(result, { headers: corsHeaders });
      } catch (e: unknown) {
        console.error("[pin-creature] Error:", e);
        return Response.json(
          { error: "Pinning failed" },
          { status: 500, headers: corsHeaders },
        );
      }
    }

    // Manual keep-alive trigger
    if (url.pathname === "/api/keep-alive" && req.method === "POST") {
      if (isRateLimited(clientIp, RATE_LIMIT_MAX_KEEPALIVE)) {
        return Response.json(
          { error: "Rate limit exceeded. Try again later." },
          { status: 429, headers: corsHeaders },
        );
      }

      try {
        await keepAlive();
        return Response.json({ status: "ok" }, { headers: corsHeaders });
      } catch (e: unknown) {
        console.error("[keep-alive] Error:", e);
        return Response.json(
          { error: "Keep-alive failed" },
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
