#!/bin/bash
# Deploy Next.js stack with workaround for OpenNext symlink bug
#
# OpenNext's npm install creates absolute symlinks in node_modules/.bin/
# pointing to /tmp/ paths that don't exist after build. CDK fails when
# trying to publish these assets.
#
# This script: synth -> fix symlinks -> deploy

set -e

STACK_NAME="${1:-ZmanimProdNextjs}"

echo "==> Synthesizing CDK stack..."
npx cdk synth "$STACK_NAME" > /dev/null

echo "==> Fixing broken symlinks in cdk.out..."
count=0
for link in $(find cdk.out -type l 2>/dev/null); do
    target=$(readlink "$link")
    if [[ "$target" == /tmp/* ]]; then
        rm "$link"
        ((count++))
    fi
done
echo "    Removed $count broken symlinks"

echo "==> Deploying stack..."
npx cdk deploy "$STACK_NAME" --require-approval never --app cdk.out

echo "==> Done!"
