// PM2 (bare-metal):  pm2 start ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    { name: "fivopay-crm", script: "node_modules/next/dist/bin/next", args: "start -p 3000", env: { NODE_ENV: "production" }, max_memory_restart: "700M" },
    { name: "fivopay-crm-worker", script: "node_modules/.bin/tsx", args: "--env-file=.env scripts/worker.ts", env: { NODE_ENV: "production" } },
  ],
};
