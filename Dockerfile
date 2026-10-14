# The CMS — cms.bluestardigitech.com
#
# One image serving both halves: the Express app mounts /api/v1 and then serves
# the built dashboard out of dist/ with an SPA fallback (see server/index.ts).
# That makes the dashboard same-origin with its own API, so there is no CORS
# between them and no per-environment API host to keep in sync.
#
# This previously built a static nginx image with no API in it at all, which
# meant the dashboard had to be told at build time where some other service was
# listening.

# ---- Stage 1: build the dashboard ----------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Vite inlines these at build time, so they are build args rather than runtime
# env. Leave VITE_NODE_SERVER_URL unset for this deployment: unset means
# same-origin, which is what we want when one process serves both.
ARG VITE_NODE_SERVER_URL=""
ENV VITE_NODE_SERVER_URL=$VITE_NODE_SERVER_URL

RUN npm run build


# ---- Stage 2: runtime ------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
# server/config.ts falls back to 5000; Coolify sets PORT and proxies to it.
ENV PORT=5000

# ffmpeg backs the video poster frames used by the dashboard's media tiles
# (services/mediaThumbs.ts). Without it those endpoints 404 and the UI falls
# back to loading whole videos into a <video> element.
RUN apk add --no-cache ffmpeg

# Production dependencies only. tsx is among them deliberately — `npm run
# server` executes the TypeScript sources directly, so it is a runtime
# dependency here, not a build tool.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# The server reads dist/ relative to process.cwd(), so it has to land at /app/dist.
COPY --from=build /app/dist ./dist
COPY server ./server
COPY tsconfig.json ./

# The server runs from TypeScript source, and some of it reaches into the
# frontend tree for shared logic — server/services/sleep.ts imports
# ../../src/lib/sleepSchedule. Shipping only server/ made the container crash
# on boot with ERR_MODULE_NOT_FOUND, and it would do so again the next time
# anyone shares a module, so the whole source tree comes along rather than the
# one file that happens to be needed today. It is 3.7 MB of text.
COPY src ./src

EXPOSE 5000

# /health/live only reports that the process is up. The richer /health also
# queries PocketBase, pings Redis and opens an R2 connection — using that here
# would have Docker kill the container whenever a dependency blipped, which is
# the opposite of what a restart fixes.
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider "http://localhost:${PORT}/health/live" || exit 1

CMD ["npm", "run", "server"]
