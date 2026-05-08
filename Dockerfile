FROM node:22-slim
RUN apt-get update -y && apt-get install -y openssl
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN mkdir -p data
EXPOSE 3002
CMD ["sh", "-c", "npx prisma db push && node_modules/.bin/tsx server.ts"]
