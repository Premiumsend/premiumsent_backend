import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const backendRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

/**
 * Fragment CLI uchun Python: .env PYTHON_PATH → backend/.venv → tizim python3
 */
export function resolvePythonCommand() {
  const fromEnv = (process.env.PYTHON_PATH || "").trim();
  if (fromEnv) return fromEnv;

  const isWin = process.platform === "win32";
  const candidates = isWin
    ? [path.join(backendRoot, ".venv", "Scripts", "python.exe")]
    : [
        path.join(backendRoot, ".venv", "bin", "python3"),
        path.join(backendRoot, ".venv", "bin", "python"),
      ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  return isWin ? "python" : "python3";
}

export function getBackendRoot() {
  return backendRoot;
}

export function venvPythonExists() {
  return resolvePythonCommand().includes(`${path.sep}.venv${path.sep}`);
}
