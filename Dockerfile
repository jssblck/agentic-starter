# syntax=docker/dockerfile:1.7

ARG PROJECT_VERSION=0.0.0

FROM rust:1.97.1-bookworm AS native-builder
ARG PROJECT_VERSION
ENV PROJECT_VERSION=${PROJECT_VERSION}
WORKDIR /src
COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY crates ./crates
RUN cargo build --release --locked --package todo-parser-napi
RUN mkdir -p /out && cp target/release/libtodo_parser_napi.so /out/todo_parser.node

FROM oven/bun:1.3.14 AS web-builder
WORKDIR /app
COPY package.json bun.lock bunfig.toml tsconfig.json Cargo.toml ./
COPY apps ./apps
COPY libs ./libs
COPY tools ./tools
RUN bun install --frozen-lockfile
RUN bun run build:web

FROM oven/bun:1.3.14 AS app-builder
ARG PROJECT_VERSION
ENV PROJECT_VERSION=${PROJECT_VERSION}
WORKDIR /app
COPY package.json bun.lock bunfig.toml tsconfig.json Cargo.toml ./
COPY apps ./apps
COPY libs ./libs
COPY tools ./tools
RUN bun install --production --frozen-lockfile
COPY --from=native-builder /out/todo_parser.node ./libs/native/artifacts/todo_parser.node
RUN bun tools/write-version.ts --version "${PROJECT_VERSION}"

FROM oven/bun:1.3.14
ARG PROJECT_VERSION
ENV PROJECT_VERSION=${PROJECT_VERSION} \
    NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    RUN_MIGRATIONS=0
WORKDIR /app
COPY --from=app-builder --chown=bun:bun /app/package.json /app/bunfig.toml ./
COPY --from=app-builder --chown=bun:bun /app/node_modules ./node_modules
COPY --from=app-builder --chown=bun:bun /app/apps ./apps
COPY --from=app-builder --chown=bun:bun /app/libs ./libs
COPY --from=web-builder --chown=bun:bun /app/apps/web/dist ./apps/web/dist
COPY --chown=bun:bun scripts/docker-entrypoint.sh /usr/local/bin/todo-entrypoint
RUN chmod +x /usr/local/bin/todo-entrypoint
USER bun
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD bun -e "const response = await fetch('http://127.0.0.1:' + (process.env.PORT ?? '3000') + '/api/health'); if (!response.ok) process.exit(1)"
ENTRYPOINT ["todo-entrypoint"]
CMD ["bun", "apps/server/src/main.ts"]
