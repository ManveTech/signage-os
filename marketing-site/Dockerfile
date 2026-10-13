# The marketing site — bluestardigitech.com
#
# Static nginx. The CMS (cms.bluestardigitech.com) is a separate image built
# from the repo root; this one only needs to know its API origin.

# Stage 1: Build the Vite production bundle
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy full application code and build
COPY . .

# Where the enquiry form posts and the contact details are read from. Vite
# inlines this at build time, so it is a build arg, not runtime env — changing
# it means rebuilding the image.
ARG VITE_CMS_API=https://cms.bluestardigitech.com/api/v1
ENV VITE_CMS_API=$VITE_CMS_API

RUN npm run build

# Stage 2: Serve with high-performance Nginx
FROM nginx:alpine AS runner

# Set default port (overridden automatically if PORT environment variable is set during deployment)
ENV PORT=80

# Copy custom Nginx configuration template for dynamic port substitution
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80 by default
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
