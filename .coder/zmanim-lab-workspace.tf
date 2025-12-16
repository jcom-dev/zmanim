terraform {
  required_providers {
    coder = {
      source  = "coder/coder"
      version = "~> 0.12"
    }
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

# Coder provider configuration
provider "coder" {}

# Docker provider configuration
provider "docker" {}

# Variables
variable "web_port" {
  type        = number
  default     = 3001
  description = "Port for the Web App"
}

variable "api_port" {
  type        = number
  default     = 8080
  description = "Port for the API"
}

variable "zmanim_branch" {
  type        = string
  default     = "main"
  description = "Branch to checkout"
}

variable "zmanim_repo" {
  type        = string
  default     = "git@github.com:jcom-dev/zmanim.git"
  description = "Shtetl Zmanim repository URL"
}

# Authentication (Clerk)
variable "clerk_publishable_key" {
  type        = string
  description = "Clerk publishable key"
}

variable "clerk_secret_key" {
  type        = string
  sensitive   = true
  description = "Clerk secret key"
}

variable "clerk_jwks_url" {
  type        = string
  default     = "https://engaged-sloth-39.clerk.accounts.dev/.well-known/jwks.json"
  description = "Clerk JWKS URL for JWT verification"
}

variable "clerk_issuer" {
  type        = string
  default     = "https://engaged-sloth-39.clerk.accounts.dev"
  description = "Clerk issuer for JWT verification"
}

# Email (Resend)
variable "resend_api_key" {
  type        = string
  sensitive   = true
  description = "Resend API key for transactional emails"
}

variable "resend_domain" {
  type        = string
  default     = "shtetl.dev"
  description = "Resend verified domain"
}

variable "resend_from" {
  type        = string
  default     = "zmanim@shtetl.dev"
  description = "Default from email address"
}

# Test Environment - Clerk Test Instance
variable "clerk_test_publishable_key" {
  type        = string
  default     = ""
  description = "Clerk TEST instance publishable key (for E2E tests)"
}

variable "clerk_test_secret_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Clerk TEST instance secret key (for E2E tests)"
}

# Test Email (MailSlurp)
variable "mailslurp_api_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "MailSlurp API key for E2E email testing"
}

# AI Services (Epic 4)
variable "openai_api_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "OpenAI API key for embeddings (text-embedding-3-small)"
}

variable "anthropic_api_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Anthropic API key for Claude AI (formula generation)"
}

# Workspace metadata
data "coder_workspace" "me" {}

# Docker network for workspace
resource "docker_network" "zmanim_network" {
  name = "coder-${data.coder_workspace.me.id}"
}

locals {
  web_port    = var.web_port
  api_port    = var.api_port
  db_name     = "zmanim"
  db_user     = "zmanim"
  db_password = "zmanim_dev_${data.coder_workspace.me.id}"
}

# Custom PostgreSQL image with PostGIS + pgvector
# Built from .coder/docker/Dockerfile.postgres
resource "docker_image" "postgres" {
  name = "zmanim-postgres:17-postgis-pgvector"

  build {
    context    = "${path.module}/docker"
    dockerfile = "Dockerfile.postgres"
    tag        = ["zmanim-postgres:17-postgis-pgvector"]
  }
}

# PostgreSQL container with PostGIS + pgvector
resource "docker_container" "postgres" {
  image    = docker_image.postgres.image_id
  name     = "coder-${data.coder_workspace.me.id}-postgres"
  hostname = "postgres"

  env = [
    "POSTGRES_DB=${local.db_name}",
    "POSTGRES_USER=${local.db_user}",
    "POSTGRES_PASSWORD=${local.db_password}",
    "PGDATA=/var/lib/postgresql/data/pgdata"
  ]

  networks_advanced {
    name = docker_network.zmanim_network.name
  }

  volumes {
    volume_name    = "coder-${data.coder_workspace.me.id}-postgres-data"
    container_path = "/var/lib/postgresql/data"
  }

  # Health check
  healthcheck {
    test     = ["CMD-SHELL", "pg_isready -U ${local.db_user}"]
    interval = "10s"
    timeout  = "5s"
    retries  = 5
  }
}

# Redis container
resource "docker_container" "redis" {
  image    = "redis:7-alpine"
  name     = "coder-${data.coder_workspace.me.id}-redis"
  hostname = "redis"

  command = ["redis-server", "--appendonly", "yes"]

  networks_advanced {
    name = docker_network.zmanim_network.name
  }

  volumes {
    volume_name    = "coder-${data.coder_workspace.me.id}-redis-data"
    container_path = "/data"
  }

  # Health check
  healthcheck {
    test     = ["CMD", "redis-cli", "ping"]
    interval = "10s"
    timeout  = "3s"
    retries  = 5
  }
}

# Pre-built development image with all dependencies
resource "docker_image" "workspace" {
  name          = "jcomdev/zmanim:latest"
  pull_triggers = ["always"]
}

# Main development container
resource "docker_container" "workspace" {
  image = docker_image.workspace.image_id
  name  = "coder-${data.coder_workspace.me.id}"

  # Run as the coder user
  user = "coder"

  env = [
    "CODER_AGENT_TOKEN=${coder_agent.main.token}",
    # Clerk Authentication
    "CLERK_SECRET_KEY=${var.clerk_secret_key}",
    "CLERK_JWKS_URL=${var.clerk_jwks_url}",
    "CLERK_ISSUER=${var.clerk_issuer}",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${var.clerk_publishable_key}",
    "NEXT_PUBLIC_API_URL=http://localhost:${local.api_port}",
    # Local database and cache (via Docker network hostnames)
    "DATABASE_URL=postgresql://${local.db_user}:${local.db_password}@postgres:5432/${local.db_name}",
    "REDIS_URL=redis://redis:6379",
    "POSTGRES_HOST=postgres",
    "POSTGRES_PORT=5432",
    "POSTGRES_DB=${local.db_name}",
    "POSTGRES_USER=${local.db_user}",
    "POSTGRES_PASSWORD=${local.db_password}",
    "REDIS_HOST=redis",
    "REDIS_PORT=6379",
    # Test Clerk instance (for E2E tests)
    "CLERK_TEST_SECRET_KEY=${var.clerk_test_secret_key}",
    "CLERK_TEST_PUBLISHABLE_KEY=${var.clerk_test_publishable_key}",
    # Test email service
    "MAILSLURP_API_KEY=${var.mailslurp_api_key}",
    # Email (Resend)
    "RESEND_API_KEY=${var.resend_api_key}",
    "RESEND_DOMAIN=${var.resend_domain}",
    "RESEND_FROM=${var.resend_from}",
    # AI Services (Epic 4)
    "OPENAI_API_KEY=${var.openai_api_key}",
    "ANTHROPIC_API_KEY=${var.anthropic_api_key}",
    # CORS configuration for API
    "ALLOWED_ORIGINS=http://localhost:${local.web_port},http://127.0.0.1:${local.web_port},http://localhost:${local.api_port},http://127.0.0.1:${local.api_port},https://localhost:${local.web_port},https://127.0.0.1:${local.web_port},https://localhost:${local.api_port},https://127.0.0.1:${local.api_port}",
    # Service ports
    "WEB_PORT=${local.web_port}",
    "API_PORT=${local.api_port}",
    # Repository configuration
    "ZMANIM_REPO=${var.zmanim_repo}",
    "ZMANIM_BRANCH=${var.zmanim_branch}",
  ]

  networks_advanced {
    name = docker_network.zmanim_network.name
  }

  # Depends on database and cache
  depends_on = [
    docker_container.postgres,
    docker_container.redis
  ]

  # Expose service ports for direct access
  ports {
    internal = local.api_port
    external = local.api_port
    protocol = "tcp"
  }

  ports {
    internal = local.web_port
    external = local.web_port
    protocol = "tcp"
  }

  # Mount workspace directory as a persistent volume
  volumes {
    volume_name    = "coder-${data.coder_workspace.me.id}-workspace"
    container_path = "/home/coder/workspace"
  }

  # Keep container running
  command = ["sh", "-c", coder_agent.main.init_script]
}

# Coder agent for the workspace
resource "coder_agent" "main" {
  arch           = "amd64"
  os             = "linux"
  startup_script = file("${path.module}/startup-fast.sh")

  # Display apps
  display_apps {
    vscode                 = true
    vscode_insiders        = false
    web_terminal           = true
    port_forwarding_helper = true
    ssh_helper             = true
  }
}

# Metadata for workspace
resource "coder_metadata" "workspace_info" {
  resource_id = docker_container.workspace.id

  item {
    key   = "Web App"
    value = "http://localhost:${local.web_port}"
  }

  item {
    key   = "API"
    value = "http://localhost:${local.api_port}"
  }

  item {
    key   = "Database"
    value = "PostgreSQL postgres:5432 (local Docker)"
  }

  item {
    key   = "Cache"
    value = "Redis redis:6379"
  }

  item {
    key   = "DB Connection"
    value = "postgresql://${local.db_user}:***@postgres:5432/${local.db_name}"
  }
}

# Web-based access to services
# Note: These apps are proxied through Coder's web UI
# For direct access, use port forwarding to localhost:3001 and localhost:8080
resource "coder_app" "web_app" {
  agent_id     = coder_agent.main.id
  slug         = "web"
  display_name = "Web App"
  url          = "http://127.0.0.1:${local.web_port}"
  icon         = "/icon/nextjs.svg"
  external     = true
  # Note: external=true conflicts with healthcheck, subdomain, and share
  # External apps open directly in browser, bypassing Coder proxy
}

resource "coder_app" "api" {
  agent_id     = coder_agent.main.id
  slug         = "api"
  display_name = "API"
  url          = "http://localhost:${local.api_port}/health"
  icon         = "/icon/go.svg"
  external     = true
  # Note: external=true conflicts with healthcheck, subdomain, and share
}
