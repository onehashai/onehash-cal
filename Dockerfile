ARG NODE_VERSION=18
# ---------- Stage 1: Build ----------


FROM node:${NODE_VERSION} AS builder

WORKDIR /calid

ARG NEXTAUTH_URL
ARG NEXTAUTH_SECRET
ARG CALENDSO_ENCRYPTION_KEY
ARG NEXT_PUBLIC_WEBAPP_URL
ARG NEXT_PUBLIC_API_V2_URL
ARG DATABASE_DIRECT_URL
ARG MAX_OLD_SPACE_SIZE=4096

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

COPY ./package.json ./yarn.lock ./.yarnrc.yml ./playwright.config.ts ./turbo.json ./git-init.sh ./git-setup.sh ./i18n.json ./
COPY ./.yarn ./.yarn
COPY ./apps/web ./apps/web
COPY ./apps/api/v2 ./apps/api/v2
COPY ./packages ./packages
# COPY ./tests ./tests


RUN yarn config set httpTimeout 1200000
# RUN yarn dlx turbo prune --scope=@calcom/web --docker
RUN yarn config set enableImmutableInstalls false

RUN yarn install 
RUN yarn build

# RUN yarn plugin import workspace-tools && \
#     yarn workspaces focus --all --production
RUN rm -rf node_modules/.cache .yarn/cache apps/web/.next/cache


# # ---------- Stage 2: Production ----------

# FROM node:${NODE_VERSION}-alpine AS runner

# WORKDIR /calid

# ARG NEXT_PUBLIC_WEBAPP_URL

# ENV NODE_ENV=production
# ENV NEXT_PUBLIC_WEBAPP_URL=${NEXT_PUBLIC_WEBAPP_URL} 


# COPY ./package.json ./.yarnrc.yml ./turbo.json ./i18n.json ./
# COPY ./.yarn ./.yarn
# COPY --from=builder /calid/yarn.lock ./yarn.lock
# # COPY --from=builder /calid/node_modules ./node_modules
# COPY --from=builder /calid/packages ./packages
# COPY --from=builder /calid/apps/web ./apps/web
# COPY --from=builder /calid/packages/prisma/schema.prisma ./prisma/schema.prisma



# EXPOSE 3001

# HEALTHCHECK --interval=30s --timeout=30s --retries=5 \
#     CMD wget --spider ${NEXT_PUBLIC_WEBAPP_URL} || exit 1

# CMD ["sh", "-c", "yarn install && yarn start"]

# ---------- Stage 2: Production ----------

FROM node:${NODE_VERSION} AS production


# Enabling Corepack + specific Yarn version
RUN corepack enable && corepack prepare yarn@3.4.1 --activate

WORKDIR /app


ARG MAX_OLD_SPACE_SIZE=4096
ENV NODE_OPTIONS=--max-old-space-size=${MAX_OLD_SPACE_SIZE}

# ARG NEXTAUTH_URL
# ARG NEXT_PUBLIC_WEBAPP_URL
# ARG NEXT_PUBLIC_API_V2_URL
# ARG DATABASE_DIRECT_URL


# ENV NEXTAUTH_URL=${NEXTAUTH_URL} \
#     NEXT_PUBLIC_WEBAPP_URL=${NEXT_PUBLIC_WEBAPP_URL} \
#     NEXT_PUBLIC_API_V2_URL=${NEXT_PUBLIC_API_V2_URL} \
#     DATABASE_DIRECT_URL=$DATABASE_DIRECT_URL \
#      \
#     NODE_ENV=production \
#     CI=1


# Copying essential files and packages
COPY ./package.json ./.yarnrc.yml ./turbo.json ./i18n.json ./yarn.lock ./
COPY ./apps/api/v2 ./apps/api/v2
COPY ./packages ./packages
# COPY ./tests ./tests


# Copying yarn plugins and release version from builder stage
COPY --from=builder /calid/.yarn ./.yarn


# # Copying nextjs built app from builder stage
# COPY --from=builder /calid/apps/web/ ./apps/web/



# COPY --from=builder /app/node_modules ./node_modules




# COPY --from=builder /app/yarn.lock ./


# COPY --from=builder /app/.yarn .yarn

# Copying dependencies






# Copying Next.js build + app-specific package.json
COPY --from=builder /calid/apps/web/.next ./apps/web/.next
COPY --from=builder /calid/apps/web/public ./apps/web/public
COPY --from=builder /calid/apps/web/package.json ./apps/web/package.json



RUN yarn config set enableImmutableInstalls false


EXPOSE 3001

CMD ["sh", "-c", "yarn install && yarn start"]

