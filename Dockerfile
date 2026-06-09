FROM node:22-slim
RUN apt-get update -y && apt-get install -y openssl
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
ENV STRIPE_SECRET_KEY=sk_test_build_placeholder
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST
RUN npm run build
ENV NODE_ENV=production
CMD ["sh", "-c", "npx prisma db push && node_modules/.bin/tsx server.ts"]
