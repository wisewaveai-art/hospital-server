FROM node:20-alpine

WORKDIR /app

# Install dependencies based on package.json
COPY package*.json ./
RUN npm install --production

# Copy source code
COPY . .

EXPOSE 5000

CMD ["node", "index.js"]
