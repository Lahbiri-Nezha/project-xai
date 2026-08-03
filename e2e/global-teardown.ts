import { execSync } from "node:child_process";

export default async function globalTeardown() {
  try {
    execSync("npm run cleanup:e2e", {
      stdio: "inherit",
      shell: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
    });
  } catch (e) {
    console.warn("[globalTeardown] cleanup:e2e a échoué :", e);
  }
}
