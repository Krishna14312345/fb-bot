module.exports = {
  apps: [{
    name: 'sonu-bot',
    script: 'index.js',
    watch: true,
    autorestart: true,
    max_memory_restart: '300M',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
