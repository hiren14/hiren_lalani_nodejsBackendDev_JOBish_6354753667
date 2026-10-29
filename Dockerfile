# ---- build stage ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json knexfile.ts ./
COPY src ./src
COPY migrations ./migrations
RUN npm run build

# ---- runtime stage ----
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
# Default: API. docker-compose overrides the command for the worker and migrations.
CMD ["node", "dist/src/server.js"]