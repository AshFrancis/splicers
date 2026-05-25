# splicers server — Bun runtime + stellar CLI (for the keepAlive contract call).
# Built ON the box from /opt/apps/splicers/server. Frontend is on Pages.

# ---- deps ----
FROM oven/bun:1.3 AS deps
WORKDIR /app
COPY bun.lock package.json ./
RUN bun install --frozen-lockfile --production

# ---- runner ----
FROM oven/bun:1.3 AS runner
WORKDIR /app
# stellar CLI prebuilt (linux-gnu — Debian glibc match).
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates libdbus-1-3 \
    && curl -fsSL -o /tmp/stellar.tgz \
       https://github.com/stellar/stellar-cli/releases/download/v23.2.1/stellar-cli-23.2.1-x86_64-unknown-linux-gnu.tar.gz \
    && tar -xzf /tmp/stellar.tgz -C /usr/local/bin stellar \
    && chmod +x /usr/local/bin/stellar \
    && rm /tmp/stellar.tgz \
    && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
COPY --from=deps --chown=bun:bun /app/node_modules ./node_modules
COPY --chown=bun:bun . ./
RUN chmod +x docker-entrypoint.sh && cp docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
USER bun
ENV STELLAR_BIN=/usr/local/bin/stellar \
    HOME=/tmp \
    XDG_CONFIG_HOME=/tmp/.config \
    XDG_CACHE_HOME=/tmp/.cache \
    XDG_DATA_HOME=/tmp/.local/share \
    PORT=3001
EXPOSE 3001
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["bun", "run", "index.ts"]
