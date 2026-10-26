# Near-Circle API container (development).
FROM node:22-alpine
WORKDIR /srv/api
COPY package.json ./
RUN npm install --no-audit --no-fund --loglevel=error
COPY tsconfig.json ./
COPY src ./src
EXPOSE 3001
ENV API_PORT=3001
CMD ["npm", "run", "dev"]
