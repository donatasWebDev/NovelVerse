FROM node:20-alpine AS build

WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build   # outputs to /app/dist

# Production stage - lightweight nginx
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

# Optional: custom nginx config for React Router
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]