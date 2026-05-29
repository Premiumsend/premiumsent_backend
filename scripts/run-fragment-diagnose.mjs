import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { resolvePythonCommand } from "../modules/usdtStars/pythonPath.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const py = resolvePythonCommand();
const script = path.join(root, "scripts", "fragment_diagnose.py");
const args = [script, ...process.argv.slice(2)];

const r = spawnSync(py, args, { cwd: root, stdio: "inherit" });
process.exit(r.status ?? 1);
