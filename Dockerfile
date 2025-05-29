ARG NODE_VERSION=22

# ---------- Stage 1: Build ----------


FROM node:${NODE_VERSION}-slim AS builder

# RUN corepack enable && corepack prepare yarn@3.4.1 --activate

WORKDIR /calid

ARG NEXTAUTH_URL
ARG NEXTAUTH_SECRET
ARG CALENDSO_ENCRYPTION_KEY
ARG NEXT_PUBLIC_WEBAPP_URL
ARG NEXT_PUBLIC_API_V2_URL
ARG NEXT_PUBLIC_WEBSITE_URL
ARG MAX_OLD_SPACE_SIZE=8192

COPY . .

# Install env dependencies
RUN set -eux; \
    apt-get update -qq && \
    apt-get install -y build-essential openssl pkg-config python-is-python3 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives && \
    yarn config set httpTimeout 1200000

RUN export NEXTAUTH_URL=${NEXTAUTH_URL} && \
export NEXTAUTH_SECRET=${NEXTAUTH_SECRET} && \
export CALENDSO_ENCRYPTION_KEY=${CALENDSO_ENCRYPTION_KEY} && \
export NEXT_PUBLIC_WEBAPP_URL=${NEXT_PUBLIC_WEBAPP_URL} && \
export NEXT_PUBLIC_WEBSITE_URL=${NEXT_PUBLIC_WEBSITE_URL} && \
export NEXT_PUBLIC_API_V2_URL=${NEXT_PUBLIC_API_V2_URL} && \
export NODE_OPTIONS=--max-old-space-size=${MAX_OLD_SPACE_SIZE} && \
export BUILD_STANDALONE=true && \
export NODE_ENV=production && \
export CI=1 && \
yarn install && yarn build

RUN rm -rf node_modules/.cache .yarn/cache apps/web/.next/cache

# ---------- Stage 2: Production ----------

FROM node:${NODE_VERSION}-slim AS production


RUN set -eux; \
    apt-get update -qq && \
    apt-get install -y build-essential openssl pkg-config python-is-python3 && \
    apt-get clean && \
    # required for accessing psql inside of container, when running psql on host ,rather than on remote service like RDS
    apt-get update && apt-get install -y postgresql-client && \ 
    rm -rf /var/lib/apt/lists /var/cache/apt/archives && \
    yarn config set httpTimeout 1200000

WORKDIR /app

ARG MAX_OLD_SPACE_SIZE=8192
ENV NODE_OPTIONS=--max-old-space-size=${MAX_OLD_SPACE_SIZE}

# Copying essential files and packages
COPY ./package.json ./.yarnrc.yml ./turbo.json ./i18n.json ./yarn.lock ./
COPY ./apps/api/v2 ./apps/api/v2
COPY ./packages ./packages

# Copying yarn plugins and release version from builder stage
COPY --from=builder /calid/.yarn ./.yarn

# Copying the build output from the builder stage
COPY --from=builder /calid/apps/web/ ./apps/web/

# Copying node_modules from builder stage
COPY --from=builder /calid/node_modules ./node_modules

COPY ./entrypoint.sh ./
RUN chmod +x ./entrypoint.sh

ARG IS_ROLLBACK=false
ENV IS_ROLLBACK=$IS_ROLLBACK

# Allowing mutable installs
# RUN yarn config set enableImmutableInstalls false

# EXPOSING PORT
EXPOSE 3001

CMD ["sh", "./entrypoint.sh"]

