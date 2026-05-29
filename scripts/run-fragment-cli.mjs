import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { resolvePythonCommand } from "../modules/usdtStars/pythonPath.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "modules", "usdtStars", "fragment_cli.py");
const py = resolvePythonCommand();
const args = process.argv.slice(2);

const r = spawnSync(py, [cli, ...args], { cwd: root, stdio: "inherit" });
process.exit(r.status ?? 1);
