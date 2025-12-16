/**
 * Zmanim CDKTF Application Entry Point
 *
 * This creates the Zmanim production infrastructure stack.
 * All Zmanim-specific resources are in a single stack for simplified deployment.
 *
 * State Location: s3://shtetl-tf/zmanim-prod/terraform.tfstate
 *
 * Dependencies: This stack depends on shtetl-common stack outputs:
 *   - vpc_id, public_subnet_id, public_subnet_az, hosted_zone_id
 *
 * Usage:
 *   cd infrastructure
 *   npm install
 *   npx cdktf synth                     # Generate Terraform JSON
 *   npx cdktf diff zmanim-prod          # Preview changes
 *   npx cdktf deploy zmanim-prod        # Deploy
 */

import { App } from "cdktf";
import { ZmanimProdStack } from "./lib/stacks/zmanim-prod";
import { zmanimConfig } from "./lib/config";

const app = new App();

new ZmanimProdStack(app, "zmanim-prod", {
  config: zmanimConfig,
});

app.synth();
