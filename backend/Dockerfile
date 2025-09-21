FROM node:23-alpine

WORKDIR /app

# Add these if you still need to compile native deps
RUN apk add --no-cache python3 make g++

COPY backend/package.json ./
COPY backend/package-lock.json ./

RUN npm install

COPY backend .

# Expose port (optional, if your app uses a specific port)
RUN npx prisma generate

EXPOSE 4000

CMD ["npm", "start"]