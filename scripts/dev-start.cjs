process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/home_buddy";
process.env.NODE_ENV = "development";
process.env.PORT = process.env.PORT || "5000";

const { spawn } = require("child_process");

const child = spawn("npx", ["tsx", "server/index.ts"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env },
});

child.on("exit", (code) => process.exit(code || 0));
