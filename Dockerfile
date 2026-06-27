# Use Node 20 as base
FROM node:20-slim

# Install yt-dlp, python3, ffmpeg
RUN apt-get update && apt-get install -y \
    yt-dlp \
    python3 \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy server code
COPY server/ ./server/
COPY nixpacks.toml railway.json ./

# Install dependencies
RUN cd server && npm install

# Create temp dir for music downloads
RUN mkdir -p /app/temp

# Expose port
EXPOSE 8080

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:8080/api/ping || exit 1

# Start
CMD cd server && node index.js
