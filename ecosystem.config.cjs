module.exports = {
  apps: [
    {
      name: 'adowatch-api',
      script: './server.js',
      cwd: './api',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 5000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: '../logs/api-error.log',
      out_file: '../logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      listen_timeout: 3000,
      kill_timeout: 5000
    },
    {
      name: 'video-server',
      script: './server.js',
      cwd: './video-server',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '3G',
      env: {
        NODE_ENV: 'development',
        PORT: 5001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5001
      },
      error_file: '../logs/video-server-error.log',
      out_file: '../logs/video-server-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      listen_timeout: 3000,
      kill_timeout: 5000
    }
  ]
};
