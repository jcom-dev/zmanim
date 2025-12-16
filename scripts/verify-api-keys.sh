#!/bin/bash
# Verify AI API keys are configured and working
# Usage: ./scripts/verify-api-keys.sh
#
# Exit codes:
#   0 - All keys verified successfully
#   1 - One or more keys missing or invalid

set -e

echo "🔐 Verifying AI API Keys..."
echo ""

ERRORS=0

# Check OpenAI API Key
echo "1. Checking OpenAI API Key..."
if [ -z "$OPENAI_API_KEY" ]; then
    echo "   ❌ OPENAI_API_KEY is not set"
    echo "   → Set it in .env.openai or as Coder parameter"
    ERRORS=$((ERRORS + 1))
else
    echo "   ✓ OPENAI_API_KEY is set (${#OPENAI_API_KEY} chars)"

    # Test OpenAI API connectivity
    echo "   Testing API connectivity..."
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
        "https://api.openai.com/v1/models" \
        -H "Authorization: Bearer $OPENAI_API_KEY" \
        2>/dev/null || echo "000")

    if [ "$RESPONSE" = "200" ]; then
        echo "   ✓ OpenAI API key is valid (HTTP 200)"
    elif [ "$RESPONSE" = "401" ]; then
        echo "   ❌ OpenAI API key is invalid (HTTP 401 Unauthorized)"
        ERRORS=$((ERRORS + 1))
    elif [ "$RESPONSE" = "000" ]; then
        echo "   ⚠️  Could not connect to OpenAI API (network issue?)"
    else
        echo "   ⚠️  Unexpected response from OpenAI API (HTTP $RESPONSE)"
    fi
fi

echo ""

# Check Anthropic API Key
echo "2. Checking Anthropic API Key..."
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "   ❌ ANTHROPIC_API_KEY is not set"
    echo "   → Set it in .env.claude or as Coder parameter"
    ERRORS=$((ERRORS + 1))
else
    echo "   ✓ ANTHROPIC_API_KEY is set (${#ANTHROPIC_API_KEY} chars)"

    # Test Anthropic API connectivity
    echo "   Testing API connectivity..."
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
        "https://api.anthropic.com/v1/messages" \
        -H "x-api-key: $ANTHROPIC_API_KEY" \
        -H "anthropic-version: 2023-06-01" \
        -H "content-type: application/json" \
        -d '{"model":"claude-3-haiku-20240307","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}' \
        2>/dev/null || echo "000")

    if [ "$RESPONSE" = "200" ]; then
        echo "   ✓ Anthropic API key is valid (HTTP 200)"
    elif [ "$RESPONSE" = "401" ]; then
        echo "   ❌ Anthropic API key is invalid (HTTP 401 Unauthorized)"
        ERRORS=$((ERRORS + 1))
    elif [ "$RESPONSE" = "000" ]; then
        echo "   ⚠️  Could not connect to Anthropic API (network issue?)"
    else
        echo "   ⚠️  Unexpected response from Anthropic API (HTTP $RESPONSE)"
    fi
fi

echo ""

# Summary
if [ $ERRORS -eq 0 ]; then
    echo "✅ All API keys verified successfully!"
    echo "   AI features (Epic 4) are ready to use."
    exit 0
else
    echo "❌ $ERRORS error(s) found."
    echo "   Fix the issues above before using AI features."
    echo ""
    echo "📝 Setup instructions:"
    echo "   1. Get OpenAI API key from: https://platform.openai.com/api-keys"
    echo "   2. Get Anthropic API key from: https://console.anthropic.com/settings/keys"
    echo "   3. Create .env.openai with: OPENAI_API_KEY=sk-proj-..."
    echo "   4. Create .env.claude with: ANTHROPIC_API_KEY=sk-ant-..."
    echo "   5. Run: .coder/push-template.sh to update Coder workspace"
    exit 1
fi
