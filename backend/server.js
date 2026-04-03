const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const axios = require("axios");

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


const PORT = 3001;
app.listen(PORT, () => console.log("Backend running on port", PORT));