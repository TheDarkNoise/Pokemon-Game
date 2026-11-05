const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');

module.exports = {
  apps: [
    {
      name: 'pokemon-game-server',
      cwd: projectRoot,
      script: 'npm',
      args: 'run start:server',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production'
      },
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      time: true
    },
    {
      name: 'pokemon-game-web',
      cwd: projectRoot,
      script: 'npm',
      args: 'run start:preview',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production'
      },
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      time: true
    }
  ]
};
