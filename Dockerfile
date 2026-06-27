# Use Node 20 as base
FROM node:20-slim

# Install python3, ffmpeg, curl
RUN apt-get update && apt-get install -y \
    python3 \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Download static yt-dlp binary
RUN curl -#L -o /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
    && chmod +x /usr/local/bin/yt-dlp \
    && yt-dlp --version

# Set working directory
WORKDIR /app

# Copy server code
COPY server/ ./server/
COPY railway.json ./

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
