#!/bin/bash
set -e

echo "🔐 GitHub Secrets Setup Script"
echo "================================"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed"
    echo "   Install it: brew install gh"
    exit 1
fi

# Check if logged in to GitHub
if ! gh auth status &> /dev/null; then
    echo "❌ Not logged in to GitHub"
    echo "   Run: gh auth login"
    exit 1
fi

# Check if .env.prod exists
if [ ! -f .env.prod ]; then
    echo "❌ .env.prod file not found"
    echo "   Make sure you're in the project root directory"
    exit 1
fi

echo "✅ Prerequisites met"
echo ""

# Source environment variables
source .env.prod

echo "📋 Setting GitHub Secrets..."
echo ""

# Set Convex URL
echo "  🔧 Setting VITE_CONVEX_URL..."
gh secret set VITE_CONVEX_URL --body "https://nautical-guanaco-500.convex.cloud"

# Set Convex Deploy Key (user needs to paste this manually)
echo ""
echo "  🔑 Setting CONVEX_DEPLOY_KEY..."
echo "     ⚠️  You need to get this from the Convex Dashboard"
echo "     1. Run: npx convex dashboard --prod"
echo "     2. Go to Settings → CI/CD"
echo "     3. Copy the Deploy Key"
echo "     4. Paste it when prompted below"
echo ""
gh secret set CONVEX_DEPLOY_KEY

# Set API Keys from .env.prod
echo ""
echo "  🔧 Setting AUTH_SENDGRID_KEY..."
gh secret set AUTH_SENDGRID_KEY --body "$AUTH_SENDGRID_KEY"

echo "  🔧 Setting AUTH_EMAIL_FROM..."
gh secret set AUTH_EMAIL_FROM --body "$AUTH_EMAIL_FROM"

echo "  🔧 Setting GEMINI_API_KEY..."
gh secret set GEMINI_API_KEY --body "$GEMINI_API_KEY"

echo "  🔧 Setting SONIOX_API_KEY..."
gh secret set SONIOX_API_KEY --body "$SONIOX_API_KEY"

# Optional keys
if [ ! -z "$CLAUDE_API_KEY" ]; then
    echo "  🔧 Setting CLAUDE_API_KEY..."
    gh secret set CLAUDE_API_KEY --body "$CLAUDE_API_KEY"
fi

if [ ! -z "$ELEVEN_LABS_KEY" ]; then
    echo "  🔧 Setting ELEVEN_LABS_KEY..."
    gh secret set ELEVEN_LABS_KEY --body "$ELEVEN_LABS_KEY"
fi

if [ ! -z "$POSTHOG_API_KEY" ]; then
    echo "  🔧 Setting POSTHOG_API_KEY..."
    gh secret set POSTHOG_API_KEY --body "$POSTHOG_API_KEY"
fi

echo ""
echo "✅ GitHub Secrets setup complete!"
echo ""
echo "📋 Verify secrets with: gh secret list"
echo ""
echo "🚀 Next steps:"
echo "  1. Configure Fly.io app: flyctl apps create smart-transcribe"
echo "  2. Test deployment pipeline: git push origin main"
echo ""
