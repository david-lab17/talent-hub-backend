# Use Node.js as the base image
FROM node:20-slim AS builder

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the TypeScript application
RUN npm run build

# Use a lighter image for production
FROM node:20-slim

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy the built application from the builder stage
COPY --from=builder /app/dist ./dist
# Copy all source files to the final image to support drizzle-kit and seeding
# (which depend on TypeScript source files like schema.ts and seed.ts)
COPY . .

# Expose the port the app runs on
EXPOSE 3001

# Start the application
CMD ["npm", "run", "start"]
