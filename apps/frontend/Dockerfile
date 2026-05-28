FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies (skip build scripts to avoid issues in container)
RUN pnpm install --frozen-lockfile --dangerously-allow-all-builds --no-scripts

# Copy application code
COPY . .

# Build the Next.js app for production
RUN pnpm build

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose port for the production Next.js server
ENV NODE_ENV=production
EXPOSE 3000

# Run entrypoint script
ENTRYPOINT ["/entrypoint.sh"]
