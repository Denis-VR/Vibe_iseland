import { chmod, cp, mkdir, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
const target = await mkdtemp(join(tmpdir(), "vibe-island-release-"));
// mkdtemp uses 0700; nginx needs traversal through the release root.
await chmod(target, 0o755);
await cp("dist-local", join(target, "dist-local"), { recursive: true });
await cp("private", join(target, "private"), { recursive: true });
await cp("server", join(target, "server"), { recursive: true });
await mkdir(join(target, "scripts"));
for (const name of ["stats.mjs", "reports.mjs"]) await cp(`scripts/${name}`, join(target, "scripts", name));
for (const file of ["package.json", "package-lock.json"])
  await cp(join("deploy/runtime", file), join(target, file));
console.log(target);
