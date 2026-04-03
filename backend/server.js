const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const axios = require("axios");

const axios = require("axios");
const { findNodeModules, getFolderSizeBytes, deleteFolder } = require("./scan");

const app = express();
app.use(cors());
app.use(express.json());

let rootPath = "C:\\";

function toProjectRoot(folderPath) {
  const normalizedFolder = path.resolve(folderPath);
  const markerDirs = new Set([
    "node_modules",
    "venv",
    ".venv",
    ".next",
    "target",
  ]);

  return markerDirs.has(path.basename(normalizedFolder).toLowerCase())
    ? path.dirname(normalizedFolder)
    : normalizedFolder;
}

function sanitizeDescription(text) {
  if (!text || typeof text !== "string") {
    return "";
  }

  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const idx = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** idx;
  return `${value.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
}

app.get("/scan", async (req, res) => {
  const selectedPath = req.query.path;
  const scanRoot =
    selectedPath && typeof selectedPath === "string" ? selectedPath : rootPath;

  rootPath = scanRoot;

  const result = await findNodeModules(scanRoot);
  res.json({ rootPath: scanRoot, folders: result });
});

app.get("/size", async (req, res) => {
  const folderPath = req.query.path;

  if (!folderPath || typeof folderPath !== "string") {
    return res.status(400).json({ error: "Missing path query parameter" });
  }

  try {
    const bytes = getFolderSizeBytes(folderPath);
    return res.json({ path: folderPath, bytes });
  } catch {
    return res.status(500).json({ error: "Failed to calculate folder size" });
  }
});


const PORT = 3001;
app.listen(PORT, () => console.log("Backend running on port", PORT));