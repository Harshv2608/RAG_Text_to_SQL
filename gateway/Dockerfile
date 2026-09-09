FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# Build step if required (optional since we use tsx)
# RUN npm run build

# Default command can be overridden by docker-compose for worker vs API
CMD ["npx", "tsx", "src/index.ts"]
