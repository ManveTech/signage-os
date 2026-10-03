FROM node:20-alpine

# Build deps for better-sqlite3, redis-server, and ffmpeg (video poster frames for dashboard tiles)
RUN apk add --no-cache python3 make g++ sqlite-dev redis ffmpeg

WORKDIR /app

# Copy package files
COPY package*.json ./

RUN npm install

# Copy the rest of the application
COPY . .

# Expose the server port
EXPOSE 5000

# Start the server
CMD ["npm", "run", "server"]
