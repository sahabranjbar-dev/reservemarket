ARG BASE_IMAGE=docker.arvancloud.ir/library/node:20-bookworm

FROM ${BASE_IMAGE} AS base

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps

COPY package.json yarn.lock ./
COPY .npmrc ./.npmrc

RUN yarn install --frozen-lockfile --ignore-scripts

FROM base AS development

COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 3000

CMD ["yarn", "dev:docker"]

FROM base AS builder

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN yarn prisma:generate \
  && yarn build

FROM base AS runner

ENV NODE_ENV=production
ENV PORT=3000

COPY --chown=node:node --from=builder /app ./

USER node

EXPOSE 3000

CMD ["yarn", "start:docker"]
