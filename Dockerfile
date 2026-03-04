# syntax=docker/dockerfile:1
FROM node:20-slim

RUN apt-get update && apt-get install --no-install-recommends -y \
    chromium \
    fonts-freefont-ttf \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives

# Tell Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN useradd app
RUN mkdir -p /home/app/config /home/app/screenshot
RUN chown -R app:app /home/app

USER app
WORKDIR /home/app

# Install all dependencies (including dev) for building
COPY package*.json ./
RUN npm ci

# Build TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --omit=dev


ENTRYPOINT ["node"]
CMD ["dist/index.js"]

EXPOSE 5000
