FROM node:20-bookworm-slim

# Install TypeScript and ts-node globally
RUN npm install -g ts-node typescript

WORKDIR /app/backend

# Copy package files and install deps
COPY backend/package*.json ./
RUN npm install

# Copy source code
COPY backend/ .

EXPOSE 4000

# Run with ts-node (no build needed)
CMD ["ts-node", "./index.ts"]