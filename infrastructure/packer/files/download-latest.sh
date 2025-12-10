#!/bin/bash
set -euo pipefail

# Download latest API binary from S3 before starting the service
# This allows code updates without rebuilding the AMI

BINARY_PATH="/opt/zmanim/zmanim-api"
S3_BUCKET="${S3_RELEASES_BUCKET:-zmanim-releases}"
S3_KEY="${S3_BINARY_KEY:-releases/latest/zmanim-api}"
TEMP_BINARY="/tmp/zmanim-api.new"

echo "Checking for latest API binary in S3..."

# Download latest binary from S3
if aws s3 cp "s3://${S3_BUCKET}/${S3_KEY}" "${TEMP_BINARY}" 2>/dev/null; then
    echo "Downloaded latest binary from s3://${S3_BUCKET}/${S3_KEY}"

    # Verify it's executable
    chmod +x "${TEMP_BINARY}"

    # Replace current binary
    mv "${TEMP_BINARY}" "${BINARY_PATH}"
    chown zmanim:zmanim "${BINARY_PATH}"

    echo "API binary updated successfully"
else
    echo "No binary found in S3, using AMI version"

    # Verify AMI binary exists and is executable
    if [ ! -f "${BINARY_PATH}" ]; then
        echo "ERROR: No API binary found in AMI or S3"
        exit 1
    fi

    chmod +x "${BINARY_PATH}"
    echo "Using AMI binary version"
fi

# Display binary info
ls -lh "${BINARY_PATH}"
