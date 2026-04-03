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

function getFolderSizeBytes(folderPath) {
  let total = 0;

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        try {
          total += fs.statSync(fullPath).size;
        } catch {
          continue;
        }
      }
    }
  }

  walk(folderPath);
  return total;
}

async function deleteFolder(folderPath) {
  try {
    fs.rmSync(folderPath, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

module.exports = { findNodeModules, getFolderSizeBytes, deleteFolder };
