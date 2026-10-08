#!/usr/bin/env bash
# ==============================================================================
# Nexa Loan Management System - Ubuntu VPS Server Setup Script
# ==============================================================================
# Target: Ubuntu 22.04 LTS / Ubuntu 24.04 LTS
# Run as root or with sudo:
#   sudo bash deploy/scripts/deploy-setup.sh
# ==============================================================================

set -eo pipefail

if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root or using sudo: sudo bash $0"
  exit 1
fi

echo "=============================================================================="
echo "🔧 Nexa Loan Management System - Ubuntu VPS Server Provisioning"
echo "=============================================================================="

# 1. System Package Updates
echo "Step 1: Updating system packages..."
apt-get update && apt-get upgrade -y
apt-get install -y curl wget git ufw certbot python3-certbot-nginx build-essential logrotate htop

# 2. Node.js 20 LTS Installation (NodeSource)
echo "Step 2: Installing Node.js 20 LTS..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
echo "✓ Node.js version: $(node -v) | npm version: $(npm -v)"

# 3. Global Process Manager (PM2) Installation
echo "Step 3: Installing PM2 process manager..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi
echo "✓ PM2 version: $(pm2 -v)"

# 4. MySQL 8.0 Server Installation
echo "Step 4: Ensuring MySQL 8.0 Server is installed..."
if ! command -v mysql &> /dev/null; then
    apt-get install -y mysql-server
    systemctl enable mysql
    systemctl start mysql
fi
echo "✓ MySQL service active: $(systemctl is-active mysql)"

# 5. Nginx Web Server Installation
echo "Step 5: Ensuring Nginx Web Server is installed..."
if ! command -v nginx &> /dev/null; then
    apt-get install -y nginx
    systemctl enable nginx
    systemctl start nginx
fi
echo "✓ Nginx service active: $(systemctl is-active nginx)"

# 6. Create Dedicated System Directories
echo "Step 6: Creating system directories..."
mkdir -p /var/www/nexa-lms
mkdir -p /var/log/nexa-lms
mkdir -p /var/backups/nexa-lms
mkdir -p /var/www/certbot

chown -R www-data:www-data /var/log/nexa-lms
chmod 755 /var/log/nexa-lms
chmod 700 /var/backups/nexa-lms

# 7. Configure Logrotate
echo "Step 7: Configuring logrotate..."
if [ -f "deploy/logrotate/nexa-lms" ]; then
    cp deploy/logrotate/nexa-lms /etc/logrotate.d/nexa-lms
    chmod 644 /etc/logrotate.d/nexa-lms
fi

# 8. Firewall Configuration (UFW)
echo "Step 8: Configuring UFW firewall rules..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
# Do not expose MySQL port 3306 to public internet; keep internal to 127.0.0.1
ufw --force enable

echo "=============================================================================="
echo "✓ Server Provisioning Complete!"
echo "Next Steps:"
echo "  1. Create MySQL database and user:"
echo "     sudo mysql -e \"CREATE DATABASE nexa_lms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\""
echo "     sudo mysql -e \"CREATE USER 'nexa_admin'@'localhost' IDENTIFIED BY 'YOUR_PASSWORD';\""
echo "     sudo mysql -e \"GRANT ALL PRIVILEGES ON nexa_lms.* TO 'nexa_admin'@'localhost'; FLUSH PRIVILEGES;\""
echo "  2. Clone repository into /var/www/nexa-lms"
echo "  3. Configure /var/www/nexa-lms/.env"
echo "  4. Run migrations: npx prisma migrate deploy"
echo "  5. Build & launch via PM2 and Nginx"
echo "=============================================================================="
