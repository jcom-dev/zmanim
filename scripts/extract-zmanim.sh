#!/bin/bash
cd /home/coder/workspace/zmanim
source api/.env

TOKEN=$(node scripts/get-test-token.js 2>&1 | grep "^eyJ")

curl -s -H "Authorization: Bearer $TOKEN" -H "X-Publisher-Id: 2" \
  "http://localhost:8080/api/v1/publisher/zmanim/week?start_date=$1&latitude=53.508945047109776&longitude=-2.258496600758501&timezone=Europe/London" \
  | jq -r '.data.days[0].zmanim[] | "\(.zman_key): \(.time)"' | sort
