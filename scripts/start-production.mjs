import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

process.env.NODE_ENV = "production";

const bundledServer = new URL("../dist/index.js", import.meta.url);
const useSourceServer = process.env.PATHFINDER_SOURCE_SERVER === "1";
if (!useSourceServer && existsSync(fileURLToPath(bundledServer))) {
  await import(bundledServer.href);
} else {
  const { register } = await import("tsx/esm/api");
  register();
  await import("../server/_core/index.ts");
}
