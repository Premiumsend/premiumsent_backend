/**
 * Fragment Python kutubxonalarini tekshirish.
 * cd backend && node scripts/check-python-deps.js
 */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { resolvePythonCommand } from "../modules/usdtStars/pythonPath.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const py = resolvePythonCommand();
console.log("Python:", py);

const modules = ["dotenv", "socks", "psycopg2", "pyfragment"];
const missing = [];

for (const mod of modules) {
  const r = spawnSync(py, ["-c", `import ${mod}`], {
    cwd: root,
    encoding: "utf8",
  });
  if (r.status !== 0) {
    missing.push(mod);
    console.error(`❌ ${mod}: yo'q`);
    if (r.stderr) console.error(r.stderr.trim().slice(0, 200));
  } else {
    console.log(`✅ ${mod}`);
  }
}

if (missing.length) {
  console.error("\n👉 O'rnatish: npm run fragment:install");
  console.error("   (Ubuntu: node scripts/setup-python-venv.mjs)");
  process.exit(1);
}

console.log("\n✅ Barcha Fragment Python modullari tayyor");
