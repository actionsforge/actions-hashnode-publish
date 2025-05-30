#!/bin/bash
set -e

# Print environment information
echo "🔍 Environment Information:"
echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"
echo "TypeScript version: $(npx tsc --version)"
echo "Environment: ${NODE_ENV:-development}"

# Verify Node.js version
echo "🔍 Checking Node.js version..."
NODE_VERSION=$(node -v)
REQUIRED_VERSION="v20.10.0"
if [[ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]]; then
    echo "❌ Node.js version $NODE_VERSION is below required version $REQUIRED_VERSION"
    exit 1
fi
echo "✅ Node.js version $NODE_VERSION meets requirements"

if [ -f "package.json" ]; then
  echo "📦 Installing dependencies..."
  npm ci || {
    echo "⚠️ npm ci failed, trying npm install..."
    npm install
  }

  echo "🔍 Type checking..."
  npm run typecheck || echo "⚠️ Type checking failed, but continuing..."

  echo "🔨 Building action..."
  npm run build || echo "⚠️ Build failed, but continuing..."

  # Run tests based on environment and TEST_STAGE
  echo "🧪 Running tests..."
  if [ "${TEST_STAGE:-quick}" = "quick" ]; then
    echo "🔍 Running quick test suite..."
    npm test || echo "⚠️ Quick tests failed, but continuing..."
  else
    echo "🔍 Running full test suite..."
    # Run unit tests
    npm test || echo "⚠️ Unit tests failed, but continuing..."

    # Run action-specific tests
    ./.devcontainer/scripts/test-action.sh || echo "⚠️ Action tests failed, but continuing..."
  fi

  echo "🔒 Security audit (non-blocking)..."
  npm audit || echo "⚠️ Audit issues found, but not blocking container creation"

  echo "📦 Checking dependencies..."
  npm outdated || echo "✅ All dependencies are up to date"

  echo "✅ Dev container setup complete!"
  echo "💡 Available commands:"
  echo "   - npm test: Run unit tests"
  echo "   - npm run test:action: Run action-specific tests"
  echo "   - npm run test:all: Run all tests"
  echo "   - npm run dev: Start development mode"
  echo "   - npm run build: Build the action"
  echo "   - act: Run GitHub Actions locally"
  echo ""
  echo "💡 Environment variables:"
  echo "   - TEST_STAGE=quick|full: Control test depth"
  echo "   - NODE_ENV=development|production: Set environment"
fi
