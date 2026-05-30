FROM node:20

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy source code
COPY . .

# Remove the Linux user creation commands for Windows compatibility
# RUN addgroup -g 1001 -S nodejs && \
#     adduser -S nextjs -u 1001

# USER nextjs

EXPOSE 5000

CMD ["node", "server.js"]