const fs = require("fs");
const path = require("path");

async function findNodeModules(root) {
  const results = [];
  const targetDirs = new Set([
    "node_modules",
    "venv",
    ".venv",
    ".next",
    "target",
  ]);

  async function scan(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (targetDirs.has(entry.name.toLowerCase())) {
          results.push(path.join(dir, entry.name));
        } else {
          await scan(path.join(dir, entry.name));
        }
      }
    }
  }

  await scan(root);
  return results;
  
}