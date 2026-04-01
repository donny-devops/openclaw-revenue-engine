# =============================================================================
# openclaw-revenue-engine — Multi-stage Dockerfile
# Stage 1: deps       — install production dependencies
# Stage 2: builder    — compile TypeScript
# Stage 3: runner     — minimal production image
# =============================================================================

# ---- Stage 1: deps ----
FROM node:20-alpine AS deps
WORKDIR /app

# Copy only package files for better layer caching
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# ---- Stage 2: builder ----
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files and install ALL dependencies (including devDeps for build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and config
COPY tsconfig.json ./
COPY src ./src

# Compile TypeScript
RUN npm run build

# ---- Stage 3: runner ----
FROM node:20-alpine AS runner
WORKDIR /app

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 appuser

# Copy production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy compiled output from builder stage
COPY --from=builder /app/dist ./dist

# Copy package.json for metadata
COPY package.json ./

# Set ownership
RUN chown -R appuser:nodejs /app
USER appuser

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]
