# Stage 1: Build the React application
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Build-time environment variables for Vite
ARG VITE_API_BASE_URL
ARG VITE_POCKETBASE_URL
ARG GEMINI_API_KEY

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_POCKETBASE_URL=$VITE_POCKETBASE_URL
ENV GEMINI_API_KEY=$GEMINI_API_KEY

RUN npm run build

# Stage 2: Serve the build directory using Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
