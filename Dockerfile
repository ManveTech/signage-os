# The admin dashboard — cms.bluestardigitech.com
#
# Static build on nginx. The API is a separate service (see the `api` service in
# docker-compose.yml, built from server/Dockerfile), so this image contains no
# server at all — it only needs to know where to send its requests.
#
# Routing is HashRouter (src/main.tsx), so every route lives after a '#' and
# never reaches nginx. That is why there is no SPA fallback here.

# ---- Stage 1: build -------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Where the dashboard sends its API calls. Vite inlines this at build time, so
# it is a build arg rather than runtime env — changing it needs a rebuild.
#
# The name matters: this used to declare VITE_API_BASE_URL and
# VITE_POCKETBASE_URL, neither of which src/config.ts ever reads. The build args
# were quietly doing nothing and the real value came from .env being copied into
# the image. With .env now excluded, this is the only way the value gets in.
ARG VITE_NODE_SERVER_URL=https://api.bluestardigitech.com
ENV VITE_NODE_SERVER_URL=$VITE_NODE_SERVER_URL

RUN npm run build


# ---- Stage 2: serve -------------------------------------------------------
FROM nginx:alpine AS runner

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
