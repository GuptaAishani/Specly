FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY dist ./dist
COPY studio ./studio
USER node
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server/start.mjs"]
