# Use official Bun image
FROM oven/bun:1 AS base
WORKDIR /app
RUN apt-get update -y \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

# Install production dependencies
FROM base AS install
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Final production image
FROM base AS release
ENV NODE_ENV=production

COPY --from=install /app/node_modules ./node_modules
COPY package.json bun.lock tsconfig.json ./
COPY src ./src
COPY public ./public

# Create upload directory for profile images
RUN mkdir -p /app/public/uploads/profiles && chmod -R 777 /app/public/uploads

EXPOSE 8481

# Run the Elysia app
CMD ["bun", "run", "start"]
