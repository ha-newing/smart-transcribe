.PHONY: help install dev build test lint clean convex-dev convex-deploy convex-env-sync

help:
	@echo "Smart Transcribe - Available commands:"
	@echo "  make install          - Install all dependencies"
	@echo "  make dev              - Run frontend dev server"
	@echo "  make convex-dev       - Run Convex backend dev"
	@echo "  make build            - Build frontend for production"
	@echo "  make lint             - Run linter"
	@echo "  make convex-deploy    - Deploy Convex backend to production"
	@echo "  make convex-env-sync  - Sync .env to Convex environment variables"
	@echo "  make clean            - Clean build artifacts"

install:
	@echo "Installing dependencies..."
	cd frontend && npm install

dev:
	@echo "Starting frontend dev server..."
	cd frontend && npm run dev

convex-dev:
	@echo "Starting Convex backend dev..."
	cd frontend && npx convex dev

build:
	@echo "Building frontend..."
	cd frontend && npm run build

lint:
	@echo "Running linter..."
	cd frontend && npm run lint

test:
	@echo "Running tests..."
	cd frontend && npm test

convex-deploy:
	@echo "Deploying Convex backend to production..."
	cd frontend && npx convex deploy --prod

convex-env-sync:
	@echo "Syncing environment variables to Convex..."
	@if [ ! -f .env ]; then \
		echo "Error: .env file not found"; \
		exit 1; \
	fi
	@cd frontend && \
	npx convex env set AUTH_SENDGRID_KEY "$$(grep SENDGRID_API_KEY ../.env | cut -d '=' -f2-)" && \
	npx convex env set AUTH_EMAIL_FROM "Smart Transcribe <$$(grep SENDGRID_FROM_EMAIL ../.env | cut -d '=' -f2-)>" && \
	npx convex env set CLAUDE_API_KEY "$$(grep CLAUDE_API_KEY ../.env | cut -d '=' -f2-)" && \
	npx convex env set GEMINI_API_KEY "$$(grep GEMINI_API_KEY ../.env | cut -d '=' -f2-)" && \
	npx convex env set SONIOX_API_KEY "$$(grep SONIOX_API_KEY ../.env | cut -d '=' -f2-)" && \
	npx convex env set ELEVEN_LABS_KEY "$$(grep ELEVEN_LABS_KEY ../.env | cut -d '=' -f2-)" && \
	npx convex env set AZURE_STORAGE_CONNECTION_STRING "$$(grep AZURE_STORAGE_CONNECTION_STRING ../.env | cut -d '=' -f2-)"
	@echo "Environment variables synced successfully!"

clean:
	@echo "Cleaning build artifacts..."
	cd frontend && rm -rf dist node_modules/.tmp node_modules/.cache
