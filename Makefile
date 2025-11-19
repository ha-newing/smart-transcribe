.PHONY: help install dev build test lint clean convex-dev convex-deploy convex-env-sync deploy fly-deploy deploy-all

help:
	@echo "Smart Transcribe - Available commands:"
	@echo "  make install          - Install all dependencies"
	@echo "  make dev              - Run frontend dev server"
	@echo "  make convex-dev       - Run Convex backend dev"
	@echo "  make build            - Build frontend for production"
	@echo "  make lint             - Run linter"
	@echo "  make test             - Run tests"
	@echo "  make deploy           - Deploy Convex backend to production"
	@echo "  make fly-deploy       - Deploy frontend to Fly.io"
	@echo "  make deploy-all       - Deploy both Convex and Fly.io"
	@echo "  make convex-deploy    - Deploy Convex backend only"
	@echo "  make convex-env-sync  - Sync .env.prod to Convex (only if not set)"
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
	@echo "🚀 Deploying Convex backend to production..."
	cd frontend && npx convex deploy --yes

convex-env-sync:
	@echo "🔄 Syncing environment variables to Convex production..."
	@if [ ! -f .env.prod ]; then \
		echo "❌ Error: .env.prod file not found"; \
		exit 1; \
	fi
	@echo "📋 Checking which environment variables need to be set..."
	@cd frontend && \
	ENV_LIST=$$(npx convex env list 2>/dev/null || echo ""); \
	\
	if ! echo "$$ENV_LIST" | grep -q "AUTH_SENDGRID_KEY"; then \
		echo "  ⚙️  Setting AUTH_SENDGRID_KEY..."; \
		npx convex env set AUTH_SENDGRID_KEY "$$(grep '^AUTH_SENDGRID_KEY=' ../.env.prod | cut -d '=' -f2-)"; \
	else \
		echo "  ✅ AUTH_SENDGRID_KEY already set"; \
	fi; \
	\
	if ! echo "$$ENV_LIST" | grep -q "AUTH_EMAIL_FROM"; then \
		echo "  ⚙️  Setting AUTH_EMAIL_FROM..."; \
		npx convex env set AUTH_EMAIL_FROM "$$(grep '^AUTH_EMAIL_FROM=' ../.env.prod | cut -d '=' -f2-)"; \
	else \
		echo "  ✅ AUTH_EMAIL_FROM already set"; \
	fi; \
	\
	if ! echo "$$ENV_LIST" | grep -q "GEMINI_API_KEY"; then \
		echo "  ⚙️  Setting GEMINI_API_KEY..."; \
		npx convex env set GEMINI_API_KEY "$$(grep '^GEMINI_API_KEY=' ../.env.prod | cut -d '=' -f2-)"; \
	else \
		echo "  ✅ GEMINI_API_KEY already set"; \
	fi; \
	\
	if ! echo "$$ENV_LIST" | grep -q "SONIOX_API_KEY"; then \
		echo "  ⚙️  Setting SONIOX_API_KEY..."; \
		npx convex env set SONIOX_API_KEY "$$(grep '^SONIOX_API_KEY=' ../.env.prod | cut -d '=' -f2-)"; \
	else \
		echo "  ✅ SONIOX_API_KEY already set"; \
	fi
	@echo "✅ Environment variables synced successfully!"

deploy: convex-env-sync convex-deploy
	@echo ""
	@echo "✅ Convex deployment complete!"
	@echo ""
	@echo "📋 Next steps:"
	@echo "  1. Deploy frontend: make fly-deploy"
	@echo "  2. Set GitHub secrets: ./scripts/setup-github-secrets.sh"
	@echo "  3. Test the app: flyctl open"

fly-deploy:
	@echo "🚀 Deploying frontend to Fly.io..."
	@if ! command -v flyctl &> /dev/null; then \
		echo "❌ flyctl not installed. Install it: brew install flyctl"; \
		exit 1; \
	fi
	@cd frontend && flyctl deploy \
		--build-arg VITE_CONVEX_URL=https://nautical-guanaco-500.convex.cloud \
		--wait-timeout 15m \
		--remote-only
	@echo ""
	@echo "✅ Frontend deployment complete!"
	@echo "🌐 Open app: flyctl open"

deploy-all: deploy fly-deploy
	@echo ""
	@echo "✅ Full deployment complete!"
	@echo ""
	@echo "📋 Deployment summary:"
	@echo "  ✅ Convex backend: https://nautical-guanaco-500.convex.cloud"
	@echo "  ✅ Frontend: Check with 'flyctl status'"
	@echo ""
	@echo "🌐 Open app: flyctl open"

clean:
	@echo "Cleaning build artifacts..."
	cd frontend && rm -rf dist node_modules/.tmp node_modules/.cache
