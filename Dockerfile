FROM mcr.microsoft.com/playwright:v1.64.1-noble
WORKDIR /app
COPY package*.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build -w apps/backend
ENV NODE_ENV=production
ENV DATA_DIR=/data/objects
RUN mkdir -p /data/objects && chown -R pwuser:pwuser /data /app
USER pwuser
EXPOSE 3000
CMD ["node","apps/backend/dist/apps/backend/src/index.js"]
