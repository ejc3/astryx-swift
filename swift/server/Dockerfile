# The API alone (docs/SYNC.md, "What runs where"). zero-cache runs from its own pinned image,
# rocicorp/zero:1.11.0, in the same task. Multi-arch base: builds on and for arm64 (Graviton) and
# amd64. Build from the repository root:
#   docker build -f server/Dockerfile -t astryx-api .
# Run with PORT and the settings server/src/main.ts lists, from the environment (secrets from
# Secrets Manager through the task definition), never baked into the image.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
# @rocicorp/zero's SQLite binding builds from source where no prebuilt binary fits.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY core/package.json core/
COPY sync/package.json sync/
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --omit=dev --workspace server

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY package.json ./
COPY core/package.json core/
COPY core/src core/src
COPY sync/package.json sync/
COPY sync/src sync/src
COPY server/package.json server/
COPY server/src server/src
USER node
# Node 22.18+ runs the TypeScript sources directly (type stripping): there is no build step.
CMD ["node", "server/src/main.ts"]
