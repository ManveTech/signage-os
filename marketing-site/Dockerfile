# The marketing site — bluestardigitech.com
#
# Static nginx. The CMS (cms.bluestardigitech.com) is a separate image built
# from the repo root; this one only needs to know its API origin.

# Stage 1: Build the Vite production bundle
FROM node:20-alpine AS builder

# Not /app: the site has its own app/ folder (the TV download page,
# bluestardigitech.com/app), and with the build running in /app as well Vite
# silently drops the homepage — the image then served nginx's sample page
# (2026-10-23). Any other directory name is fine.
WORKDIR /site

# Copy package manifests and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy full application code and build
COPY . .

# Where the enquiry form posts and the contact details are read from. Vite
# inlines this at build time, so it is a build arg, not runtime env — changing
# it means rebuilding the image.
ARG VITE_CMS_API=https://api.bluestardigitech.com/api/v1
ENV VITE_CMS_API=$VITE_CMS_API

RUN npm run build

# Fail the build rather than ship an image without its pages: with no
# dist/index.html, nginx:alpine's own "Welcome to nginx!" page is what gets
# served on the homepage (seen 2026-10-23). A failed build leaves the running
# site up and puts the reason in Coolify's log.
RUN for f in index.html app/index.html app/releases/index.html privacy/index.html; do \
      test -s "dist/$f" || { echo "Build output is missing dist/$f"; ls -R dist | head -50; exit 1; }; \
    done

# Stage 2: Serve with high-performance Nginx
FROM nginx:alpine AS runner

# Set default port (overridden automatically if PORT environment variable is set during deployment)
ENV PORT=80

# Copy custom Nginx configuration template for dynamic port substitution
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Copy compiled static assets from builder stage. The base image's sample
# homepage goes first, so it can never be served as ours (50x.html stays —
# nginx.conf.template uses it for error pages).
RUN rm -f /usr/share/nginx/html/index.html
COPY --from=builder /site/dist /usr/share/nginx/html

# Expose port 80 by default
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
