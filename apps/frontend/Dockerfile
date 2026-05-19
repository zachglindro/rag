FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile --dangerously-allow-all-builds

# Copy application code
COPY . .

# Expose port for Next.js dev server
EXPOSE 3000

# Run Next.js dev server
CMD ["pnpm", "dev"]
