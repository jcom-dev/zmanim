#!/bin/bash
# Deploy all CDK stacks with proper cleanup
#
# This script handles two issues:
# 1. Stale compiled TypeScript in bin/ can cause CDK to fail
# 2. OpenNext creates absolute symlinks in cdk.out pointing to /tmp/
#
# Usage:
#   ./deploy.sh              # Deploy all stacks
#   ./deploy.sh --diff       # Show diff only (no deploy)
#   ./deploy.sh StackName    # Deploy specific stack

set -e

cd "$(dirname "$0")"

DIFF_ONLY=false
STACK_NAME="--all"

# Parse arguments
for arg in "$@"; do
    case $arg in
        --diff)
            DIFF_ONLY=true
            ;;
        *)
            STACK_NAME="$arg"
            ;;
    esac
done

echo "==> Cleaning bin/ folder (stale compiled TypeScript)..."
rm -f bin/*.js bin/*.d.ts

echo "==> Compiling TypeScript..."
npx tsc

echo "==> Synthesizing CDK stacks..."
npx cdk synth > /dev/null

echo "==> Fixing broken symlinks in cdk.out..."
count=0
for link in $(find cdk.out -type l 2>/dev/null); do
    target=$(readlink "$link")
    if [[ "$target" == /tmp/* ]]; then
        rm "$link"
        ((count++)) || true
    fi
done
echo "    Removed $count broken symlinks"

if [ "$DIFF_ONLY" = true ]; then
    echo "==> Showing diff..."
    npx cdk diff $STACK_NAME --app cdk.out || true
else
    echo "==> Deploying $STACK_NAME..."
    npx cdk deploy $STACK_NAME --require-approval never --app cdk.out

    echo "==> Done!"
fi
