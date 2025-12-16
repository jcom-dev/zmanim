packer {
  required_plugins {
    amazon = {
      version = ">= 1.0.0"
      source  = "github.com/hashicorp/amazon"
    }
  }
}

source "amazon-ebs" "zmanim" {
  ami_name      = "zmanim-${var.version}-${var.build_timestamp}"
  instance_type = var.instance_type
  region        = var.region

  source_ami_filter {
    filters = {
      name                = "ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-arm64-server-*"
      virtualization-type = "hvm"
      root-device-type    = "ebs"
    }
    owners      = ["099720109477"] # Canonical
    most_recent = true
  }

  ssh_username = "ubuntu"

  tags = {
    Name        = "zmanim-${var.version}"
    Version     = var.version
    BuildDate   = timestamp()
    Environment = "production"
    ManagedBy   = "Packer"
  }
}

build {
  sources = ["source.amazon-ebs.zmanim"]

  # Install all packages
  provisioner "shell" {
    script = "${path.root}/scripts/install-packages.sh"
  }

  # Copy configuration files
  provisioner "file" {
    source      = "${path.root}/files/postgresql.conf"
    destination = "/tmp/postgresql.conf"
  }

  provisioner "file" {
    source      = "${path.root}/files/pg_hba.conf"
    destination = "/tmp/pg_hba.conf"
  }

  provisioner "file" {
    source      = "${path.root}/files/redis.conf"
    destination = "/tmp/redis.conf"
  }

  # Copy systemd service files
  provisioner "file" {
    source      = "${path.root}/files/zmanim-api.service"
    destination = "/tmp/zmanim-api.service"
  }

  provisioner "file" {
    source      = "${path.root}/files/restic-backup.service"
    destination = "/tmp/restic-backup.service"
  }

  provisioner "file" {
    source      = "${path.root}/files/restic-backup.timer"
    destination = "/tmp/restic-backup.timer"
  }

  provisioner "file" {
    source      = "${path.root}/files/backup-notify@.service"
    destination = "/tmp/backup-notify@.service"
  }

  # Copy scripts
  provisioner "file" {
    source      = "${path.root}/files/backup.sh"
    destination = "/tmp/backup.sh"
  }

  provisioner "file" {
    source      = "${path.root}/files/notify-failure.sh"
    destination = "/tmp/notify-failure.sh"
  }

  provisioner "file" {
    source      = "${path.root}/files/download-latest.sh"
    destination = "/tmp/download-latest.sh"
  }

  provisioner "file" {
    source      = "${path.root}/files/config.env.template"
    destination = "/tmp/config.env.template"
  }

  # Copy firstboot service and script
  provisioner "file" {
    source      = "${path.root}/files/zmanim-firstboot.service"
    destination = "/tmp/zmanim-firstboot.service"
  }

  provisioner "file" {
    source      = "${path.root}/files/zmanim-db-init.service"
    destination = "/tmp/zmanim-db-init.service"
  }

  provisioner "file" {
    source      = "${path.root}/files/postgresql-override.conf"
    destination = "/tmp/postgresql-override.conf"
  }

  provisioner "file" {
    source      = "${path.root}/files/firstboot.sh"
    destination = "/tmp/firstboot.sh"
  }

  # Copy pre-built Go API binary
  provisioner "file" {
    source      = var.api_binary_path
    destination = "/tmp/zmanim-api"
  }

  # Configure PostgreSQL
  provisioner "shell" {
    script = "${path.root}/scripts/configure-postgres.sh"
  }

  # Configure Redis
  provisioner "shell" {
    script = "${path.root}/scripts/configure-redis.sh"
  }

  # Configure systemd services
  provisioner "shell" {
    script = "${path.root}/scripts/configure-systemd.sh"
  }

  # Generate manifest file with AMI ID
  post-processor "manifest" {
    output     = "manifest.json"
    strip_path = true
  }
}
