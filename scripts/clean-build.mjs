import { rm } from "node:fs/promises";
import path from "node:path";

const generatedPaths = [".next", "tsconfig.tsbuildinfo"];

for (const relativePath of generatedPaths) {
  const targetPath = path.resolve(process.cwd(), relativePath);
  await rm(targetPath, { recursive: true, force: true });
  console.log(`[build] cleaned ${relativePath}`);
}
