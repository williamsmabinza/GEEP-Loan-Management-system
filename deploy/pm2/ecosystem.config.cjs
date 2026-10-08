// ==============================================================================
// Nexa Loan Management System - PM2 Enterprise Production Ecosystem Configuration
// ==============================================================================
// Usage:
//   pm2 start deploy/pm2/ecosystem.config.cjs --env production
//   pm2 reload deploy/pm2/ecosystem.config.cjs --env production --update-env
//   pm2 save
// ==============================================================================

module.exports = {
  apps: [
    {
      name: 'nexa-lms',
      // Production compiled bundle
      script: 'dist/server.js',
      // Cluster mode utilizes all available CPU cores on the VPS
      instances: process.env.PM2_INSTANCES || 'max',
      exec_mode: 'cluster',

      // Do not watch files in production
      watch: false,

      // Automatic memory threshold recycling
      max_memory_restart: '1G',

      // Fault tolerance & restart strategy
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      exp_backoff_restart_delay: 100,

      // Graceful shutdown & zero-downtime rolling reload settings
      kill_timeout: 6000,
      listen_timeout: 8000,

      // Production environment variables
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // Logging & standard output capture
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS Z',
      out_file: '/var/log/nexa-lms/pm2-out.log',
      error_file: '/var/log/nexa-lms/pm2-error.log',

      // Time in milliseconds to wait for process exit before forceful SIGKILL
      shutdown_with_message: true,
    },
  ],
};
