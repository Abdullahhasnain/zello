# Multi-stage build relying on next.config.mjs's `output: "standalone"` —
# the runtime stage only needs the traced dependency subset Next.js
# computes, not the full node_modules tree.

FROM node:20-alpine AS base
RUN corepack enable

# --- deps: install once, cached across builds unless lockfiles change ---
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/dashboard/package.json ./apps/dashboard/
COPY apps/widget/package.json ./apps/widget/
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/
# The storefront loads the voice widget from dashboard/public. Build it in the
# same image so a dashboard deployment can never serve a stale checked-in JS
# bundle after the widget source has changed.
RUN pnpm install --frozen-lockfile --filter=@zello-ai/dashboard... --filter=@zello-ai/widget...

# --- builder ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/dashboard/node_modules ./apps/dashboard/node_modules
COPY --from=deps /app/apps/widget/node_modules ./apps/widget/node_modules
COPY . .
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
# Opt into standalone output (see next.config.mjs) — the runtime stage
# below depends on .next/standalone existing.
ENV NEXT_OUTPUT_STANDALONE=1
RUN pnpm --filter=@zello-ai/widget build:voice && cp apps/widget/dist/zello-widget.voice.js apps/dashboard/public/zello-widget.voice.js
RUN pnpm --filter=@zello-ai/dashboard build

# --- runtime: standalone output, non-root user ---
FROM base AS runtime
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/public ./apps/dashboard/public

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

CMD ["node", "apps/dashboard/server.js"]
