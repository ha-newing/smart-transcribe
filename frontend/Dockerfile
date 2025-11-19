# Multi-stage Dockerfile for Smart Transcribe Frontend

# Build stage
FROM node:22-alpine AS builder

# Set up workspace structure
WORKDIR /workspace

# Copy root package files (for npm workspaces)
COPY ../package*.json ./

# Copy frontend package files
COPY package*.json ./frontend/

# Install all workspace dependencies
RUN npm ci

# Copy frontend source code
COPY . ./frontend/

# Build argument for Convex URL
ARG VITE_CONVEX_URL
ENV VITE_CONVEX_URL=$VITE_CONVEX_URL

# Build the frontend app
WORKDIR /workspace/frontend
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files from builder
COPY --from=builder /workspace/frontend/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
