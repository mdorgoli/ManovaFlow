import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const modes = {
  lint: ["eslint", ["--no-warn-ignored"]],
  "lint:fix": ["eslint", ["--no-warn-ignored", "--fix"]],
  format: ["prettier", ["--write"]],
  "format:check": ["prettier", ["--check"]],
  "format:verify": ["prettier", ["--debug-check"]]
};
const selected = modes[process.argv[2]];
if (!selected) {
  console.error(`Choose one of: ${Object.keys(modes).join(", ")}`);
  process.exit(2);
}
const [tool, args] = selected;
const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8"
}).trim();
// Never rewrite untracked work or files excluded from Git.
const files = execFileSync("git", ["ls-files", "--cached", "-z"], {
  cwd: root,
  encoding: "utf8"
})
  .split("\0")
  .filter(Boolean)
  .filter((file) =>
    (tool === "eslint"
      ? /\.[cm]?[jt]sx?$/
      : /\.(?:[cm]?[jt]sx?|json|css|ya?ml)$/
    ).test(file)
  );
if (files.length === 0) process.exit(0);
const manifestPath = require.resolve(`${tool}/package.json`);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const bin =
  typeof manifest.bin === "string" ? manifest.bin : manifest.bin[tool];
const result = spawnSync(
  process.execPath,
  [resolve(dirname(manifestPath), bin), ...args, "--", ...files],
  {
    cwd: root,
    stdio: "inherit"
  }
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
