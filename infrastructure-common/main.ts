/**
 * Shtetl Common Infrastructure - CDKTF Entry Point
 *
 * This is the main entry point for the Shtetl Common stack.
 *
 * Bootstrap Process:
 * 1. Set skipBackend: true for initial deployment (creates state bucket)
 * 2. Run: cdktf synth && cd cdktf.out/stacks/shtetl-common && terraform init && terraform apply
 * 3. Change skipBackend: false
 * 4. Run: cdktf synth && cd cdktf.out/stacks/shtetl-common && terraform init -migrate-state
 */

import { App } from "cdktf";
import { ShtetlCommonStack } from "./lib/stacks/shtetl-common";
import { commonConfig } from "./lib/config";

const app = new App();

new ShtetlCommonStack(app, "shtetl-common", {
  config: commonConfig,
  // BOOTSTRAP: Set to true for initial deployment before state bucket exists
  // After state bucket is created, set to false and run: terraform init -migrate-state
  skipBackend: false,
});

app.synth();
