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
ARG DATABASE_DIRECT_URL

ARG MAX_OLD_SPACE_SIZE=8192

ENV NEXTAUTH_URL=${NEXTAUTH_URL} \
    NEXTAUTH_SECRET=${NEXTAUTH_SECRET} \
    CALENDSO_ENCRYPTION_KEY=${CALENDSO_ENCRYPTION_KEY} \
    NEXT_PUBLIC_WEBAPP_URL=${NEXT_PUBLIC_WEBAPP_URL} \
    NEXT_PUBLIC_API_V2_URL=${NEXT_PUBLIC_API_V2_URL} \
    DATABASE_DIRECT_URL=$DATABASE_DIRECT_URL \
    NODE_OPTIONS=--max-old-space-size=${MAX_OLD_SPACE_SIZE} \
    BUILD_STANDALONE=true \
    NODE_ENV=production \
    CI=1


COPY . .


# Install env dependencies
RUN set -eux; \
    apt-get update -qq && \
    apt-get install -y build-essential openssl pkg-config python-is-python3 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives && \
    yarn config set httpTimeout 1200000


RUN   yarn install && yarn build

RUN rm -rf node_modules/.cache .yarn/cache apps/web/.next/cache


# ---------- Stage 2: Production ----------

FROM node:${NODE_VERSION}-slim AS production

# Enabling Corepack + specific Yarn version
# RUN corepack enable && corepack prepare yarn@3.4.1 --activate

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

# Allowing mutable installs
RUN yarn config set enableImmutableInstalls false

# EXPOSING PORT
EXPOSE 3001

CMD ["sh", "-c", "yarn install && yarn start"]

