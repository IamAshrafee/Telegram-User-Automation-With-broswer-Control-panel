module.exports = {
  apps: [
    {
      name: "sys-worker-lib", // Stealth name
      script: "backend/main.py",
      interpreter: "./venv/bin/python",
      args: "",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PYTHONUNBUFFERED: "1",
        HOST: "127.0.0.1", // Listen only locally for extra security
        PORT: 9876, // Non-standard port
      },
    },
  ],
};
