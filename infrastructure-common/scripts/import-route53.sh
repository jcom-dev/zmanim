#!/bin/bash
# Import Route53 hosted zone and all DNS records into Terraform state
#
# Run this AFTER cdktf synth and terraform init:
#   cd cdktf.out/stacks/shtetl-common
#   terraform init
#   ../../../scripts/import-route53.sh
#
# Then run terraform plan to verify no changes are detected.

set -e

ZONE_ID="Z079919527B3JRWEWJVH6"

echo "=== Importing Route53 resources into Terraform state ==="
echo ""

# Import hosted zone
echo "Importing hosted zone..."
terraform import 'aws_route53_zone.hosted-zone' "$ZONE_ID" || true

# Root domain records
echo "Importing root domain records..."
terraform import 'aws_route53_record.ns' "${ZONE_ID}_shtetl.io_NS" || true
terraform import 'aws_route53_record.soa' "${ZONE_ID}_shtetl.io_SOA" || true
terraform import 'aws_route53_record.mx-root' "${ZONE_ID}_shtetl.io_MX" || true
terraform import 'aws_route53_record.txt-root' "${ZONE_ID}_shtetl.io_TXT" || true

# DMARC and DKIM records
echo "Importing DMARC/DKIM records..."
terraform import 'aws_route53_record.txt-dmarc' "${ZONE_ID}__dmarc.shtetl.io_TXT" || true
terraform import 'aws_route53_record.txt-dkim-google' "${ZONE_ID}_google._domainkey.shtetl.io_TXT" || true
terraform import 'aws_route53_record.txt-dkim-resend' "${ZONE_ID}_resend._domainkey.shtetl.io_TXT" || true
terraform import 'aws_route53_record.txt-dkim-wiki' "${ZONE_ID}_wiki._domainkey.shtetl.io_TXT" || true

# Subdomain A records
echo "Importing subdomain A records..."
terraform import 'aws_route53_record.a-ideas' "${ZONE_ID}_ideas.shtetl.io_A" || true
terraform import 'aws_route53_record.a-wiki' "${ZONE_ID}_wiki.shtetl.io_A" || true

# Send subdomain records
echo "Importing send subdomain records..."
terraform import 'aws_route53_record.mx-send' "${ZONE_ID}_send.shtetl.io_MX" || true
terraform import 'aws_route53_record.spf-send' "${ZONE_ID}_send.shtetl.io_SPF" || true

# Zmanim subdomain CNAME records
echo "Importing zmanim subdomain records..."
terraform import 'aws_route53_record.cname-acm-validation' "${ZONE_ID}__8733c97b4f6273f99257413ae41aafe9.zmanim.shtetl.io_CNAME" || true
terraform import 'aws_route53_record.cname-clerk-dkim1' "${ZONE_ID}_clk._domainkey.zmanim.shtetl.io_CNAME" || true
terraform import 'aws_route53_record.cname-clerk-dkim2' "${ZONE_ID}_clk2._domainkey.zmanim.shtetl.io_CNAME" || true
terraform import 'aws_route53_record.cname-clerk-accounts' "${ZONE_ID}_accounts.zmanim.shtetl.io_CNAME" || true
terraform import 'aws_route53_record.cname-clerk-frontend' "${ZONE_ID}_clerk.zmanim.shtetl.io_CNAME" || true
terraform import 'aws_route53_record.cname-clerk-mail' "${ZONE_ID}_clkmail.zmanim.shtetl.io_CNAME" || true

echo ""
echo "=== Import complete ==="
echo ""
echo "Next steps:"
echo "1. Run 'terraform plan' to verify no changes are detected"
echo "2. If changes are shown, adjust the Terraform code to match actual values"
echo "3. Run 'terraform plan' again until no changes are shown"
