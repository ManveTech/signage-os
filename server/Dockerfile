FROM node:20-alpine

# Install build dependencies for better-sqlite3 and install redis-server
RUN apk add --no-cache python3 make g++ sqlite-dev redis

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
