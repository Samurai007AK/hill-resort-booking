import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Copy only source inputs. Never traverse dotenv files, runtime state, or Git metadata.
const source = process.cwd();
const destination = path.resolve(source, "..", "staging", "review-source");
const allowedDirectories = new Set(["src", "test", "scripts", "db", "eval", ".github", "public"]);
const allowedFiles = new Set(["package.json", "package-lock.json", "tsconfig.json", "vitest.config.mts", "next.config.ts", "eslint.config.mjs", ".gitignore", "README.md", "deployment.md", "CONTEXT.md", "ASSUMPTIONS.md", "TDD.md"]);
await mkdir(destination, { recursive: true });
for (const item of await readdir(source, { withFileTypes: true })) {
  if ((item.isDirectory() && allowedDirectories.has(item.name)) || (item.isFile() && allowedFiles.has(item.name))) {
    await cp(path.join(source, item.name), path.join(destination, item.name), {
      recursive: true,
      filter: file => !path.basename(file).startsWith(".env") && !path.basename(file).endsWith(".tsbuildinfo"),
    });
  }
}
await writeFile(path.join(destination, "next-env.d.ts"), '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n');
// A review-only node_modules junction can point to the original installation.
// Turbopack must include both sibling directories within its compilation root.
const config = await readFile(path.join(destination, "next.config.ts"), "utf8");
const workspace = JSON.stringify(path.resolve(source, "..").replaceAll("\\", "/"));
await writeFile(path.join(destination, "next.config.ts"), config.replace("turbopack: {", `turbopack: { root: ${workspace},`));
console.log(`Prepared clean review source: ${destination}`);
