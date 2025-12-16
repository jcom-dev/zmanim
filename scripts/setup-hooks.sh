#!/bin/bash
# Setup git hooks for Shtetl Zmanim
# Run this once after cloning the repository

set -e

echo "🔧 Setting up git hooks for Shtetl Zmanim..."

# Option 1: Use Husky (if Node.js environment available)
if command -v npm &> /dev/null; then
    echo "📦 Checking for Husky..."

    if [ -d "web" ]; then
        cd web
        if [ -f "package.json" ] && grep -q "husky" package.json; then
            echo "   Installing Husky hooks..."
            npx husky install ../.husky
            echo "   ✅ Husky hooks installed"
        else
            echo "   ℹ️  Husky not in package.json, skipping"
        fi
        cd ..
    fi
fi

# Option 2: Manual git hooks setup (fallback)
echo ""
echo "📋 Setting up manual git hooks..."

HOOKS_DIR=".git/hooks"
SCRIPTS_DIR="scripts"

# Create pre-commit hook
cat > "$HOOKS_DIR/pre-commit" << 'EOF'
#!/bin/bash
# Shtetl Zmanim Pre-commit Hook
# Runs compliance checks before allowing commit

echo "🔍 Running pre-commit checks..."

./scripts/check-compliance.sh --staged

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Pre-commit checks failed!"
    echo "   Fix violations above or use 'git commit --no-verify' to skip (not recommended)"
    exit 1
fi

echo "✅ All pre-commit checks passed!"
exit 0
EOF

chmod +x "$HOOKS_DIR/pre-commit"
echo "   ✅ Pre-commit hook installed at $HOOKS_DIR/pre-commit"

# Create commit-msg hook (optional - enforce commit message format)
cat > "$HOOKS_DIR/commit-msg" << 'EOF'
#!/bin/bash
# Shtetl Zmanim Commit Message Hook
# Enforces conventional commit format

COMMIT_MSG_FILE=$1
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")

# Pattern: type(scope): description
# Example: feat(zmanim): add DSL validation
PATTERN="^(feat|fix|refactor|docs|test|chore|style|perf)(\([a-z-]+\))?: .{10,}"

if ! echo "$COMMIT_MSG" | grep -qE "$PATTERN"; then
    echo ""
    echo "❌ Invalid commit message format!"
    echo ""
    echo "Required format: type(scope): description"
    echo ""
    echo "Types: feat, fix, refactor, docs, test, chore, style, perf"
    echo "Example: feat(zmanim): add DSL validation"
    echo ""
    echo "Your message:"
    echo "$COMMIT_MSG"
    echo ""
    exit 1
fi

exit 0
EOF

chmod +x "$HOOKS_DIR/commit-msg"
echo "   ✅ Commit-msg hook installed at $HOOKS_DIR/commit-msg"

# Create pre-push hook (optional - run tests before push)
cat > "$HOOKS_DIR/pre-push" << 'EOF'
#!/bin/bash
# Shtetl Zmanim Pre-push Hook
# Runs tests before allowing push

echo "🧪 Running tests before push..."

# Backend tests
if [ -d "api" ]; then
    echo "   Testing Go backend..."
    cd api
    if ! go test ./... -short; then
        echo "❌ Backend tests failed"
        exit 1
    fi
    cd ..
fi

# Frontend type check
if [ -d "web" ]; then
    echo "   Type-checking frontend..."
    cd web
    if ! npm run type-check 2>/dev/null; then
        echo "⚠️  Frontend type check failed (continuing)"
    fi
    cd ..
fi

echo "✅ All pre-push checks passed!"
exit 0
EOF

chmod +x "$HOOKS_DIR/pre-push"
echo "   ✅ Pre-push hook installed at $HOOKS_DIR/pre-push"

echo ""
echo "✅ Git hooks setup complete!"
echo ""
echo "Installed hooks:"
echo "  - pre-commit: Compliance checks (raw SQL, fetch(), colors, etc.)"
echo "  - commit-msg: Conventional commit format enforcement"
echo "  - pre-push: Run tests before push"
echo ""
echo "To skip hooks temporarily: git commit --no-verify"
echo "To disable a hook: chmod -x .git/hooks/<hook-name>"
echo ""
