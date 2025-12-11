variable "version" {
  type        = string
  description = "AMI version (from GitHub tag, e.g., v1.0.0)"
  default     = "test-local"
}

variable "region" {
  type        = string
  description = "AWS region for AMI build"
  default     = "eu-west-1"
}

variable "instance_type" {
  type        = string
  description = "Build instance type (must be ARM64)"
  default     = "t4g.small"
}

variable "api_binary_path" {
  type        = string
  description = "Path to pre-built Go API binary (linux/arm64)"
  default     = "../../bin/zmanim-api"
}

variable "build_timestamp" {
  type        = string
  description = "Build timestamp for unique AMI names (format: YYYYMMDD-HHMMSS)"
  default     = ""
}
