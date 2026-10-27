# Near-Circle web container (development).
FROM node:22-alpine
WORKDIR /srv/web
COPY package.json ./
RUN npm install --no-audit --no-fund --loglevel=error
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public
EXPOSE 5173
CMD ["npm", "run", "dev"]
