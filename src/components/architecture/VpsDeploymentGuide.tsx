import React, { useState } from 'react';

interface DeploymentStep {
  number: number;
  title: string;
  category: string;
  summary: string;
  commands?: string[];
  codeBlock?: {
    filename?: string;
    language: string;
    content: string;
  };
  notes?: string[];
}

const DEPLOYMENT_STEPS: DeploymentStep[] = [
  {
    number: 1,
    title: 'Server Preparation',
    category: 'Infrastructure',
    summary: 'Provision an Ubuntu 22.04 LTS or 24.04 LTS VPS, configure UFW firewall rules, and install Node.js 20 LTS.',
    commands: [
      '# 1. Connect to VPS via SSH\nssh root@YOUR_SERVER_IP',
      '# 2. Update system packages and install essential toolchain\nsudo apt-get update && sudo apt-get upgrade -y\nsudo apt-get install -y curl wget git build-essential ufw certbot python3-certbot-nginx logrotate htop unzip',
      '# 3. Configure strict UFW firewall\nsudo ufw default deny incoming\nsudo ufw default allow outgoing\nsudo ufw allow OpenSSH\nsudo ufw allow 80/tcp\nsudo ufw allow 443/tcp\n# Never expose MySQL port 3306 externally; keep internal to 127.0.0.1\nsudo ufw --force enable\nsudo ufw status verbose',
      '# 4. Install Node.js 20 LTS runtime via NodeSource\ncurl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -\nsudo apt-get install -y nodejs\nnode -v  # Expected: v20.x\nnpm -v   # Expected: v10.x',
      '# 5. Install PM2 process manager globally\nsudo npm install -g pm2',
    ],
    notes: [
      'Keep port 3306 blocked on UFW to ensure the database is accessible solely by localhost.',
      'Node.js 20 LTS provides native ECMAScript Modules (ESM) support and modern crypto APIs.',
    ],
  },
  {
    number: 2,
    title: 'MySQL Installation & Hardening',
    category: 'Database',
    summary: 'Install MySQL 8.0 server, execute security hardening, and enforce local loopback binding on 127.0.0.1.',
    commands: [
      '# 1. Install MySQL 8.0 server package\nsudo apt-get install -y mysql-server\nsudo systemctl enable mysql\nsudo systemctl start mysql',
      '# 2. Run automated security initialization\nsudo mysql_secure_installation\n# -> Set root password validation to STRONG\n# -> Remove anonymous users: Yes\n# -> Disallow root login remotely: Yes\n# -> Remove test database: Yes\n# -> Reload privilege tables: Yes',
      '# 3. Verify MySQL binds strictly to 127.0.0.1 in /etc/mysql/mysql.conf.d/mysqld.cnf:\n# bind-address = 127.0.0.1\n# default-time-zone = \'+00:00\'\nsudo systemctl restart mysql',
    ],
    notes: [
      'InnoDB ACID engine is used for all 21 relational tables.',
      'Default time zone must be UTC to preserve consistent financial audit timestamps.',
    ],
  },
  {
    number: 3,
    title: 'Database & Dedicated User Creation',
    category: 'Database',
    summary: 'Create the production database with utf8mb4 collation and a dedicated unprivileged application user.',
    commands: [
      '# Log in to MySQL console as root:\nsudo mysql -u root',
    ],
    codeBlock: {
      filename: 'create-database.sql',
      language: 'sql',
      content: `-- 1. Create production database with full UTF-8 Unicode support
CREATE DATABASE nexa_lms
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 2. Create dedicated application user with strong randomly generated password
CREATE USER 'nexa_admin'@'localhost' IDENTIFIED BY 'YOUR_GENERATED_STRONG_PASSWORD_HERE';
CREATE USER 'nexa_admin'@'127.0.0.1' IDENTIFIED BY 'YOUR_GENERATED_STRONG_PASSWORD_HERE';

-- 3. Grant full privileges restricted strictly to the nexa_lms database
GRANT ALL PRIVILEGES ON nexa_lms.* TO 'nexa_admin'@'localhost';
GRANT ALL PRIVILEGES ON nexa_lms.* TO 'nexa_admin'@'127.0.0.1';

FLUSH PRIVILEGES;
EXIT;`,
    },
    notes: [
      'Generate passwords using: openssl rand -base64 24',
      'Never grant global wildcard privileges (*) to the application user.',
    ],
  },
  {
    number: 4,
    title: 'Application Deployment & Directory Structure',
    category: 'Application',
    summary: 'Create isolated production filesystem directories, clone the Git repository, and assign proper permissions.',
    commands: [
      '# 1. Create required filesystem directories\nsudo mkdir -p /var/www/nexa-lms\nsudo mkdir -p /var/log/nexa-lms\nsudo mkdir -p /var/backups/nexa-lms\nsudo mkdir -p /var/www/certbot',
      '# 2. Clone Git repository into /var/www/nexa-lms\ncd /var/www/nexa-lms\ngit clone <YOUR_GIT_REPOSITORY_URL> .',
      '# 3. Set directory permissions for www-data\nsudo chown -R www-data:www-data /var/www/nexa-lms\nsudo chown -R www-data:www-data /var/log/nexa-lms\nsudo chmod 700 /var/backups/nexa-lms\nsudo chmod 755 /var/log/nexa-lms\nsudo chmod +x deploy/scripts/*.sh',
    ],
    notes: [
      'Backup directory /var/backups/nexa-lms is chmod 700 so only root can read database dumps.',
      'Deployment scripts in deploy/scripts/ must have execute (+x) permissions.',
    ],
  },
  {
    number: 5,
    title: 'Environment Variables Configuration',
    category: 'Security',
    summary: 'Configure production .env with strong secrets for DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, API_URL, and CLIENT_URL.',
    commands: [
      '# 1. Copy the production template to .env\ncd /var/www/nexa-lms\ncp .env.production.example .env\nchmod 600 .env',
      '# 2. Generate 64-character high-entropy cryptographic keys:\nopenssl rand -hex 32   # Use for JWT_SECRET\nopenssl rand -hex 32   # Use for JWT_REFRESH_SECRET\nopenssl rand -base64 24 # Use for database password',
    ],
    codeBlock: {
      filename: '/var/www/nexa-lms/.env',
      language: 'env',
      content: `# Application Core
NODE_ENV=production
PORT=3000

# Canonical URLs (Replace with your registered domain)
APP_URL=https://lms.yourdomain.com
CLIENT_URL=https://lms.yourdomain.com
API_URL=https://lms.yourdomain.com/api

# Vite Frontend Variables
VITE_API_URL=/api
VITE_APP_NAME="Nexa Loan Management System"

# MySQL Database Connection URL
DATABASE_URL="mysql://nexa_admin:YOUR_PASSWORD@127.0.0.1:3306/nexa_lms?connection_limit=20&pool_timeout=30"
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=nexa_admin
DB_PASSWORD="YOUR_PASSWORD"
DB_NAME=nexa_lms

# Cryptographic Keys (Generated via openssl rand -hex 32)
JWT_SECRET="YOUR_OPENSSL_RAND_HEX_32_JWT_SECRET"
JWT_EXPIRES_IN="8h"
JWT_REFRESH_SECRET="YOUR_OPENSSL_RAND_HEX_32_REFRESH_SECRET"
JWT_REFRESH_EXPIRES_IN="7d"

# Security & Logging
BCRYPT_SALT_ROUNDS=12
CORS_ORIGIN=https://lms.yourdomain.com
LOG_LEVEL=info
AUDIT_LOG_ENABLED=true
LOG_FILE_PATH=/var/log/nexa-lms/app.log`,
    },
    notes: [
      'chmod 600 restricts reading the .env file strictly to the file owner.',
      'Never commit the active .env file containing real secrets to Git version control.',
    ],
  },
  {
    number: 6,
    title: 'Prisma Database Migration',
    category: 'Database',
    summary: 'Install npm dependencies, generate typed Prisma client, deploy versioned migrations, and optionally seed default data.',
    commands: [
      '# 1. Install production dependencies\ncd /var/www/nexa-lms\nnpm install',
      '# 2. Generate Prisma Client models\nnpx prisma generate',
      '# 3. Deploy versioned migrations to MySQL (non-interactive)\nnpx prisma migrate deploy',
      '# 4. (Optional) Seed initial roles, branches, and sample facilities\nnpm run prisma:seed',
    ],
    notes: [
      'prisma migrate deploy executes all pending SQL DDL migrations non-interactively without prompting for confirmation.',
      'Ensures all 21 tables, foreign keys, and indexes are in place before starting the application.',
    ],
  },
  {
    number: 7,
    title: 'Frontend Production Build',
    category: 'Build',
    summary: 'Compile and bundle the React 19 Single Page Application (SPA) using Vite and Tailwind CSS into dist/.',
    commands: [
      '# Compile optimized client assets\ncd /var/www/nexa-lms\nnpm run build:client',
      '# Verify output assets in dist/\nls -lh dist/\n# index.html, assets/index-*.js, assets/index-*.css',
    ],
    notes: [
      'Vite automatically performs tree-shaking, code-splitting, minification, and CSS extraction.',
      'Static assets are fingerprinted with hashes for immutable HTTP caching.',
    ],
  },
  {
    number: 8,
    title: 'Backend Production Build',
    category: 'Build',
    summary: 'Bundle the Node.js / Express / TypeScript backend entry point into a standalone ESM file at dist/server.js.',
    commands: [
      '# Bundle TypeScript backend via esbuild\ncd /var/www/nexa-lms\nnpm run build:server',
      '# Unified alternative (runs both frontend & backend builds):\nnpm run build',
    ],
    notes: [
      'esbuild bundles server.ts targeting node20 format esm with external packages.',
      'Produces /var/www/nexa-lms/dist/server.js ready for execution with node dist/server.js.',
    ],
  },
  {
    number: 9,
    title: 'PM2 Process Management Setup',
    category: 'Process Management',
    summary: 'Launch the application in cluster mode across CPU cores with auto-restart, log redirection, and systemd reboot persistence.',
    commands: [
      '# 1. Start application cluster using ecosystem file\ncd /var/www/nexa-lms\npm2 start deploy/pm2/ecosystem.config.cjs --env production',
      '# 2. Verify cluster status\npm2 status\npm2 logs nexa-lms --lines 20',
      '# 3. Configure PM2 to start automatically on OS system boot\npm2 startup systemd -u root --hp /root\npm2 save',
    ],
    codeBlock: {
      filename: 'deploy/pm2/ecosystem.config.cjs',
      language: 'javascript',
      content: `module.exports = {
  apps: [
    {
      name: 'nexa-lms',
      script: 'dist/server.js',
      instances: process.env.PM2_INSTANCES || 'max',
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '1G',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      kill_timeout: 6000,
      listen_timeout: 8000,
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      merge_logs: true,
      out_file: '/var/log/nexa-lms/pm2-out.log',
      error_file: '/var/log/nexa-lms/pm2-error.log',
    },
  ],
};`,
    },
    notes: [
      'Cluster mode runs multiple Node.js worker instances to maximize multi-core server throughput.',
      'Graceful reload allows zero-downtime updates with pm2 reload.',
    ],
  },
  {
    number: 10,
    title: 'Nginx Reverse Proxy Configuration',
    category: 'Networking',
    summary: 'Configure Nginx as a reverse proxy with HTTP-to-HTTPS redirect, SPA fallback routing, rate limiting, and gzip compression.',
    commands: [
      '# 1. Copy Nginx virtual host configuration\nsudo cp deploy/nginx/nexa-lms.conf /etc/nginx/sites-available/nexa-lms.conf',
      '# 2. Update domain name (replace lms.yourdomain.com with your actual FQDN)\nsudo sed -i \'s/lms.yourdomain.com/YOUR_DOMAIN.com/g\' /etc/nginx/sites-available/nexa-lms.conf',
      '# 3. Enable site and disable default site\nsudo ln -sf /etc/nginx/sites-available/nexa-lms.conf /etc/nginx/sites-enabled/nexa-lms.conf\nsudo rm -f /etc/nginx/sites-enabled/default',
      '# 4. Test syntax and reload Nginx\nsudo nginx -t\nsudo systemctl reload nginx',
    ],
    notes: [
      'Nginx proxies /api to http://127.0.0.1:3000 with connection keep-alive.',
      'Static assets under /assets/ are served directly by Nginx with 1-year immutable caching.',
      'Rate limiting zones protect /api and authentication endpoints from brute-force attacks.',
    ],
  },
  {
    number: 11,
    title: 'SSL/TLS Certificate with Let\'s Encrypt',
    category: 'Security',
    summary: 'Provision free, automated SSL/TLS certificates via Certbot and enable automated certificate renewal.',
    commands: [
      '# 1. Obtain and install Let\'s Encrypt SSL certificate\nsudo certbot --nginx -d YOUR_DOMAIN.com',
      '# 2. Verify auto-renewal timer\nsudo certbot renew --dry-run\nsudo systemctl status certbot.timer',
      '# 3. Reload Nginx to apply TLS parameters\nsudo systemctl reload nginx',
    ],
    notes: [
      'Certbot automatically modifies Nginx configuration to enable HTTP/2 and modern TLS cipher suites.',
      'Renewal runs automatically twice daily via systemd certbot.timer.',
    ],
  },
  {
    number: 12,
    title: 'Database Backups & Log Rotation Strategy',
    category: 'Maintenance',
    summary: 'Configure automated daily mysqldump backups with gzip compression, 30-day retention pruning, and logrotate for logs.',
    commands: [
      '# 1. Schedule daily backups at 02:00 AM via Crontab\nsudo crontab -e\n# Add the following line:\n# 0 2 * * * /var/www/nexa-lms/deploy/scripts/backup-db.sh >> /var/log/nexa-lms/backup.log 2>&1',
      '# 2. Execute a manual test backup\nsudo bash /var/www/nexa-lms/deploy/scripts/backup-db.sh\nls -lh /var/backups/nexa-lms/',
      '# 3. Install logrotate configuration for /var/log/nexa-lms/*.log\nsudo cp deploy/logrotate/nexa-lms /etc/logrotate.d/nexa-lms\nsudo chmod 644 /etc/logrotate.d/nexa-lms\nsudo logrotate -d /etc/logrotate.d/nexa-lms',
    ],
    notes: [
      'Backups use mysqldump --single-transaction --quick for non-blocking InnoDB snapshots without database downtime.',
      'Old backups older than 30 days are automatically deleted by the script.',
    ],
  },
  {
    number: 13,
    title: 'Updating the Application (Zero-Downtime)',
    category: 'Maintenance',
    summary: 'Deploy new application releases seamlessly without user downtime using the automated deployment update script.',
    commands: [
      '# Run the zero-downtime rolling update script\ncd /var/www/nexa-lms\nsudo bash deploy/scripts/deploy-update.sh',
    ],
    notes: [
      'The script pulls latest Git commits, installs dependencies, migrates database, builds client and server, and reloads PM2 workers sequentially.',
      'A health check probe against /api/health verifies successful deployment.',
    ],
  },
  {
    number: 14,
    title: 'Disaster Recovery & Rollback Strategy',
    category: 'Disaster Recovery',
    summary: 'Rapid rollback procedure in the event of an unexpected regression or database integrity issue.',
    commands: [
      '# --- Code-level Rollback ---\ncd /var/www/nexa-lms\ngit checkout <PREVIOUS_STABLE_COMMIT_HASH>\nnpm install\nnpm run build\npm2 reload deploy/pm2/ecosystem.config.cjs --env production --update-env',
      '# --- Database Restoration ---\n# 1. List available backup snapshots\nls -lh /var/backups/nexa-lms/\n# 2. Run interactive restore script (creates safety snapshot before restoring)\nsudo bash deploy/scripts/restore-db.sh /var/backups/nexa-lms/nexa_lms_backup_YYYYMMDD_HHMMSS.sql.gz\n# 3. Restart PM2 cluster to reset database connection pools\npm2 restart nexa-lms',
    ],
    notes: [
      'The restoration script automatically takes a pre-restore safety dump before overwriting data.',
      'Always test the restore procedure in staging to ensure recovery time objectives (RTO) are met.',
    ],
  },
];

const CONFIG_FILES = [
  {
    id: 'env',
    title: '.env.production.example',
    desc: 'Environment variable configuration template with MySQL, JWT, and rate limits',
    content: `# Core Application Settings
NODE_ENV=production
PORT=3000

# Canonical URLs (Replace with your registered domain and SSL setup)
APP_URL=https://lms.yourdomain.com
CLIENT_URL=https://lms.yourdomain.com
API_URL=https://lms.yourdomain.com/api

# Vite Client Build Variables
VITE_API_URL=/api
VITE_APP_NAME="Nexa Loan Management System"

# Database Configuration (MySQL 8.0+)
DATABASE_URL="mysql://nexa_admin:YOUR_PASSWORD@127.0.0.1:3306/nexa_lms?connection_limit=20&pool_timeout=30"
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=nexa_admin
DB_PASSWORD="YOUR_PASSWORD"
DB_NAME=nexa_lms

# Cryptographic Secrets & Token Configuration (openssl rand -hex 32)
JWT_SECRET="GENERATE_HEX_32_SECRET_WITH_OPENSSL_RAND_HEX_32"
JWT_EXPIRES_IN="8h"
JWT_REFRESH_SECRET="GENERATE_HEX_32_REFRESH_SECRET_WITH_OPENSSL_RAND_HEX_32"
JWT_REFRESH_EXPIRES_IN="7d"

# Password hashing cost factor
BCRYPT_SALT_ROUNDS=12

# Network Security & CORS
CORS_ORIGIN=https://lms.yourdomain.com

# Logging & Auditing
LOG_LEVEL=info
AUDIT_LOG_ENABLED=true
LOG_FILE_PATH=/var/log/nexa-lms/app.log`,
  },
  {
    id: 'nginx',
    title: 'deploy/nginx/nexa-lms.conf',
    desc: 'Production Nginx configuration with SSL, rate limiting, and API reverse proxy',
    content: `# Rate Limiting Zones
limit_req_zone $binary_remote_addr zone=nexa_api_limit:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=nexa_auth_limit:10m rate=10r/m;

upstream nexa_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

# 1. HTTP Server Block (Port 80) -> Force Redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name lms.yourdomain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        allow all;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# 2. HTTPS Server Block (Port 443) -> Reverse Proxy & Static SPA
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name lms.yourdomain.com;

    root /var/www/nexa-lms/dist;
    index index.html;

    ssl_certificate /etc/letsencrypt/live/lms.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/lms.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    client_max_body_size 15M;
    gzip on;

    # Static Assets & Long-Term Caching
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
        try_files $uri =404;
    }

    # Sensitive Auth Endpoint Reverse Proxy (Strict Rate Limiting)
    location ~ ^/api/(?:v1/)?auth/ {
        limit_req zone=nexa_auth_limit burst=5 nodelay;
        proxy_pass http://nexa_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # General API Reverse Proxy
    location /api/ {
        limit_req zone=nexa_api_limit burst=20 nodelay;
        proxy_pass http://nexa_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA Fallback Route
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Deny direct access to backend bundle, config files, and hidden files
    location = /server.js { deny all; }
    location ~* \\.(?:env|map|ts|cjs|sql|log)$ { deny all; }
    location ~ /\\. { deny all; }
}`,
  },
  {
    id: 'pm2',
    title: 'deploy/pm2/ecosystem.config.cjs',
    desc: 'PM2 process cluster configuration with auto-restart and zero-downtime reloads',
    content: `module.exports = {
  apps: [
    {
      name: 'nexa-lms',
      script: 'dist/server.js',
      instances: process.env.PM2_INSTANCES || 'max',
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '1G',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      exp_backoff_restart_delay: 100,
      kill_timeout: 6000,
      listen_timeout: 8000,
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS Z',
      out_file: '/var/log/nexa-lms/pm2-out.log',
      error_file: '/var/log/nexa-lms/pm2-error.log',
      shutdown_with_message: true,
    },
  ],
};`,
  },
  {
    id: 'backup',
    title: 'deploy/scripts/backup-db.sh',
    desc: 'Automated MySQL backup script with gzip compression and 30-day retention pruning',
    content: `#!/usr/bin/env bash
set -eo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="\${BACKUP_DIR:-/var/backups/nexa-lms}"
RETENTION_DAYS="\${RETENTION_DAYS:-30}"
APP_DIR="\${APP_DIR:-/var/www/nexa-lms}"

if [ -f "\${APP_DIR}/.env" ]; then
    export $(grep -v '^#' "\${APP_DIR}/.env" | xargs)
fi

DB_USER="\${DB_USER:-nexa_admin}"
DB_PASSWORD="\${DB_PASSWORD:-}"
DB_HOST="\${DB_HOST:-127.0.0.1}"
DB_PORT="\${DB_PORT:-3306}"
DB_NAME="\${DB_NAME:-nexa_lms}"

mkdir -p "\${BACKUP_DIR}"
chmod 700 "\${BACKUP_DIR}"

BACKUP_FILE="\${BACKUP_DIR}/nexa_lms_backup_\${TIMESTAMP}.sql.gz"

echo "[\$(date '+%Y-%m-%d %H:%M:%S')] Starting automated database backup for '\${DB_NAME}'..."

if [ -n "\${DB_PASSWORD}" ]; then
    MYSQL_PWD="\${DB_PASSWORD}" mysqldump \\
        --host="\${DB_HOST}" --port="\${DB_PORT}" --user="\${DB_USER}" \\
        --single-transaction --quick --routines --triggers \\
        --default-character-set=utf8mb4 "\${DB_NAME}" | gzip -9 > "\${BACKUP_FILE}"
else
    mysqldump \\
        --host="\${DB_HOST}" --port="\${DB_PORT}" --user="\${DB_USER}" \\
        --single-transaction --quick --routines --triggers \\
        --default-character-set=utf8mb4 "\${DB_NAME}" | gzip -9 > "\${BACKUP_FILE}"
fi

FILE_SIZE=$(du -h "\${BACKUP_FILE}" | cut -f1)
echo "[\$(date '+%Y-%m-%d %H:%M:%S')] ✓ Backup created: \${BACKUP_FILE} (\${FILE_SIZE})"

# Prune old backups older than 30 days
find "\${BACKUP_DIR}" -name "nexa_lms_backup_*.sql.gz" -type f -mtime +"\${RETENTION_DAYS}" -exec rm -f {} +`,
  },
  {
    id: 'update',
    title: 'deploy/scripts/deploy-update.sh',
    desc: 'Zero-downtime rolling update deployment script with health verification',
    content: `#!/usr/bin/env bash
set -eo pipefail

APP_DIR="\${APP_DIR:-/var/www/nexa-lms}"
cd "\${APP_DIR}"

echo "🚀 Starting Nexa LMS Zero-Downtime Deployment Cycle"

# 1. Fetch latest changes from Git
git fetch origin main
git checkout main
git pull origin main

# 2. Install dependencies
npm install

# 3. Generate Prisma ORM client
npx prisma generate

# 4. Deploy database migrations non-interactively
npx prisma migrate deploy

# 5. Compile production assets (frontend + backend)
npm run build

# 6. Zero-downtime rolling reload via PM2 cluster
pm2 reload deploy/pm2/ecosystem.config.cjs --env production --update-env

# 7. Post-deployment verification probe
sleep 3
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/health || echo "FAILED")

if [ "\${HEALTH_STATUS}" -eq 200 ]; then
    echo "✓ Deployment Successful! Server healthy on HTTP \${HEALTH_STATUS}."
else
    echo "⚠️ Warning: Health check returned status '\${HEALTH_STATUS}'."
fi`,
  },
];

export const VpsDeploymentGuide: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number | 'all'>('all');
  const [activeConfigTab, setActiveConfigTab] = useState<string>('env');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  const activeConfigFile = CONFIG_FILES.find((c) => c.id === activeConfigTab) || CONFIG_FILES[0];

  const displayedSteps = activeStep === 'all'
    ? DEPLOYMENT_STEPS
    : DEPLOYMENT_STEPS.filter((s) => s.number === activeStep);

  return (
    <div className="space-y-8">
      {/* Target Infrastructure Architecture Badge */}
      <div className="bg-slate-900 text-white rounded-lg p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                PRODUCTION READY
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                INDEPENDENT DEPLOYMENT
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mt-2">
              External Linux VPS Production Deployment Architecture
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Target Environment: Ubuntu 22.04 / 24.04 LTS • Nginx • Node.js 20 LTS • MySQL 8.0 • SSL/HTTPS (Let's Encrypt) • PM2
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-mono uppercase text-slate-400 block">Required Env Variables</span>
            <span className="text-xs font-mono text-emerald-400 font-semibold">DATABASE_URL • JWT_SECRET • API_URL</span>
          </div>
        </div>

        {/* Visual Request Flow Diagram */}
        <div className="bg-slate-950 p-4 rounded border border-slate-800 text-xs font-mono overflow-x-auto leading-relaxed">
          <div className="text-slate-400 mb-2 font-sans font-medium text-[11px] uppercase tracking-wider">
            Production Network Flow Topology
          </div>
          <pre className="text-slate-300 text-[11px] leading-snug">
{`[ End Users / Public Internet ]
           │
           ▼
[ Port 80 / Port 443 (HTTPS) ]
           │
 ┌─────────┴───────────────────────────────────────────────────────┐
 │                       Nginx Reverse Proxy                       │
 │  - Let's Encrypt TLS 1.3 Encryption & HTTP->HTTPS 301 Redirect   │
 │  - Static SPA Assets Cache (/assets/* -> /var/www/nexa-lms/dist)│
 │  - Sliding Window DDoS Rate Limiter (/api & /api/auth)          │
 └─────────┬───────────────────────────────────────────────────────┘
           │
           │ (Internal Loopback: http://127.0.0.1:3000)
           ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │               PM2 Process Cluster (Cluster Mode)                │
 │       Node.js 20 LTS / Express Backend (dist/server.js)        │
 │       - Zero-Downtime Rolling Reloads                           │
 │       - Auto-Restart on Memory Threshold (1GB)                  │
 └─────────┬───────────────────────────────────────────────────────┘
           │
           │ (Internal TCP: 127.0.0.1:3306 - Protected via UFW)
           ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │                     MySQL 8.0 Relational DB                     │
 │  - 21 Normalized Entities • utf8mb4 • InnoDB ACID Engine        │
 │  - Strict Referential Integrity • Exact Monetary DECIMAL(16, 2) │
 └─────────────────────────────────────────────────────────────────┘`}
          </pre>
        </div>
      </div>

      {/* Configuration Files Vault & Copyable Templates */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Pre-configured Production Deployment Files
            </h3>
            <p className="text-xs text-slate-500">
              Select any configuration file to inspect and copy directly to your server
            </p>
          </div>
          <button
            onClick={() => copyToClipboard(activeConfigFile.content, `config-${activeConfigFile.id}`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-800 transition-colors"
          >
            {copiedKey === `config-${activeConfigFile.id}` ? (
              <>
                <span className="text-emerald-400 font-bold">✓</span>
                Copied to Clipboard!
              </>
            ) : (
              <>
                <span>📋</span>
                Copy File Contents
              </>
            )}
          </button>
        </div>

        {/* Config Tab Switcher */}
        <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded text-xs font-medium">
          {CONFIG_FILES.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveConfigTab(c.id)}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeConfigTab === c.id
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {c.title}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-500 italic">
          {activeConfigFile.desc}
        </div>

        <div className="bg-slate-900 text-slate-100 p-4 rounded text-xs font-mono overflow-x-auto max-h-96 leading-relaxed">
          <pre>{activeConfigFile.content}</pre>
        </div>
      </div>

      {/* 14-Step Deployment Walkthrough */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Complete 14-Step Production Deployment Guide
            </h3>
            <p className="text-xs text-slate-500">
              Sequential guide for installing, securing, building, and running Nexa LMS on a bare Linux VPS
            </p>
          </div>

          {/* Step Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => setActiveStep('all')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                activeStep === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Steps (1-14)
            </button>
            {DEPLOYMENT_STEPS.map((s) => (
              <button
                key={s.number}
                onClick={() => setActiveStep(s.number)}
                className={`w-7 h-7 rounded text-xs font-mono font-medium transition-colors flex items-center justify-center ${
                  activeStep === s.number
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                title={`Step ${s.number}: ${s.title}`}
              >
                {s.number}
              </button>
            ))}
          </div>
        </div>

        {/* Step Cards */}
        <div className="space-y-6">
          {displayedSteps.map((step) => (
            <div
              key={step.number}
              className="bg-white border border-slate-200 rounded-lg p-6 space-y-4 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-mono font-bold">
                    {step.number}
                  </span>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                      {step.category}
                    </span>
                    <h4 className="text-base font-bold text-slate-900">
                      Step {step.number}: {step.title}
                    </h4>
                  </div>
                </div>
                <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2.5 py-1 rounded border border-slate-200">
                  Step {step.number} of 14
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {step.summary}
              </p>

              {/* Commands Section */}
              {step.commands && step.commands.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">
                      Terminal Commands
                    </span>
                    <button
                      onClick={() => copyToClipboard(step.commands!.join('\n\n'), `step-cmd-${step.number}`)}
                      className="text-[11px] font-mono text-slate-600 hover:text-slate-900"
                    >
                      {copiedKey === `step-cmd-${step.number}` ? '✓ Copied' : 'Copy Commands'}
                    </button>
                  </div>
                  <div className="bg-slate-900 text-slate-100 p-3.5 rounded text-xs font-mono space-y-2 overflow-x-auto leading-relaxed">
                    {step.commands.map((cmd, idx) => (
                      <pre key={idx} className="whitespace-pre-wrap">{cmd}</pre>
                    ))}
                  </div>
                </div>
              )}

              {/* Code Block */}
              {step.codeBlock && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500 font-semibold">
                      {step.codeBlock.filename}
                    </span>
                    <button
                      onClick={() => copyToClipboard(step.codeBlock!.content, `step-code-${step.number}`)}
                      className="text-[11px] font-mono text-slate-600 hover:text-slate-900"
                    >
                      {copiedKey === `step-code-${step.number}` ? '✓ Copied' : 'Copy Code'}
                    </button>
                  </div>
                  <div className="bg-slate-900 text-slate-100 p-3.5 rounded text-xs font-mono overflow-x-auto max-h-72 leading-relaxed">
                    <pre>{step.codeBlock.content}</pre>
                  </div>
                </div>
              )}

              {/* Security & Operational Notes */}
              {step.notes && step.notes.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs space-y-1">
                  <span className="font-semibold text-slate-700 block text-[11px]">Key Technical Considerations:</span>
                  <ul className="list-disc list-inside text-slate-600 space-y-0.5 text-[11px]">
                    {step.notes.map((note, idx) => (
                      <li key={idx}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Operational Verification Cheatsheet */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Post-Deployment Operational Verification Commands
          </h3>
          <p className="text-xs text-slate-500">
            Commands to monitor, debug, and verify server health once deployed on VPS
          </p>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 font-mono text-slate-600">
              <tr>
                <th className="py-2.5 px-3">Operational Check</th>
                <th className="py-2.5 px-3">Command</th>
                <th className="py-2.5 px-3">Expected Output</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              <tr className="hover:bg-slate-50">
                <td className="py-2 px-3 font-semibold font-sans text-slate-900">Health Check</td>
                <td className="py-2 px-3 text-emerald-700">curl -i http://127.0.0.1:3000/api/health</td>
                <td className="py-2 px-3 text-slate-600">HTTP/1.1 200 OK {"{"}status: "OK", database: "connected"{"}"}</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-2 px-3 font-semibold font-sans text-slate-900">PM2 Process Cluster</td>
                <td className="py-2 px-3 text-emerald-700">pm2 status</td>
                <td className="py-2 px-3 text-slate-600">status: 'online', 0 restarts, normal memory</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-2 px-3 font-semibold font-sans text-slate-900">Application Live Logs</td>
                <td className="py-2 px-3 text-emerald-700">pm2 logs nexa-lms --lines 30</td>
                <td className="py-2 px-3 text-slate-600">Live JSON audit logs & HTTP access logs</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-2 px-3 font-semibold font-sans text-slate-900">Nginx Access Logs</td>
                <td className="py-2 px-3 text-emerald-700">sudo tail -f /var/log/nginx/nexa-lms.access.log</td>
                <td className="py-2 px-3 text-slate-600">Incoming 200/304 HTTP responses</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-2 px-3 font-semibold font-sans text-slate-900">Nginx Syntax Test</td>
                <td className="py-2 px-3 text-emerald-700">sudo nginx -t</td>
                <td className="py-2 px-3 text-slate-600">syntax is ok, test is successful</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-2 px-3 font-semibold font-sans text-slate-900">MySQL Connection</td>
                <td className="py-2 px-3 text-emerald-700">mysql -u nexa_admin -p -h 127.0.0.1 nexa_lms -e "STATUS;"</td>
                <td className="py-2 px-3 text-slate-600">Uptime, Threads, utf8mb4 connection</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
