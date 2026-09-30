FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=3000 ROBIS_DATA=/data
VOLUME /data
EXPOSE 3000
CMD ["node", "server/index.js"]
