/**
 * Ubuntu/Debian PEP 668: tizim pip o'rniga .venv yaratadi.
 * cd backend && node scripts/setup-python-venv.mjs
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const systemPy = isWin ? "python" : "python3";
const venvDir = path.join(root, ".venv");
const venvPython = isWin
  ? path.join(venvDir, "Scripts", "python.exe")
  : path.join(venvDir, "bin", "python3");
const venvPip = isWin
  ? path.join(venvDir, "Scripts", "pip.exe")
  : path.join(venvDir, "bin", "pip3");

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", ...opts });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

if (!fs.existsSync(venvDir)) {
  console.log("📦 Python venv yaratilmoqda:", venvDir);
  const created = spawnSync(systemPy, ["-m", "venv", venvDir], {
    cwd: root,
    stdio: "inherit",
  });
  if (created.status !== 0) {
    console.error(
      "\n❌ venv yaratilmadi. Ubuntu: sudo apt install -y python3-venv python3-full"
    );
    process.exit(1);
  }
}

console.log("📥 requirements.txt o'rnatilmoqda...");
run(venvPip, ["install", "--upgrade", "pip"]);
run(venvPip, ["install", "-r", "requirements.txt"]);

console.log("\n✅ Tayyor!");
console.log(`   Python: ${venvPython}`);
console.log("\n   .env ga qo'shing (ixtiyoriy, avtomatik ham topiladi):");
console.log(`   PYTHON_PATH=${venvPython}`);
console.log("\n   Tekshirish: npm run fragment:check-python");
