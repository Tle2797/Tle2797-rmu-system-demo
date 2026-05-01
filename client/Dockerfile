# Use official Bun image
FROM oven/bun:1 AS base
WORKDIR /app
RUN apt-get update -y \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install

# Install production dependencies only
RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --production

# Build the application
FROM base AS build
COPY --from=install /temp/dev/node_modules node_modules
COPY . .
RUN bun --bun run build

# Final production image
FROM base AS release
ENV NODE_ENV=production
ENV PORT=3481
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY package.json .

EXPOSE  3481

CMD ["bun", "--bun", "run", "start"]
