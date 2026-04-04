const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { readProjectFiles } = require("./describe");
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

async function getBestAvailableModel() {
  const preferred = [
    process.env.OLLAMA_MODEL,
    "llama3.1:latest",
    "deepseek-r1:1.5b",
    "llama3.2",
  ].filter(Boolean);

  try {
    const tagsRes = await axios.get("http://localhost:11434/api/tags", {
      timeout: 10000,
    });

    const installed = new Set(
      (tagsRes.data.models || []).map((model) => model.name),
    );

    for (const model of preferred) {
      if (installed.has(model)) {
        return model;
      }
    }

    return tagsRes.data.models?.[0]?.name || null;
  } catch {
    return preferred[0] || null;
  }
}

function normalizeModelName(name) {
  return typeof name === "string" ? name.trim() : "";
}

function isCudaRuntimeFailure(error) {
  const details =
    error?.response?.data?.error || error?.message || "Unknown AI failure";
  return /cuda error|llama runner process has terminated|runner terminated/i.test(
    details,
  );
}

async function getInstalledModelNames() {
  try {
    const tagsRes = await axios.get("http://localhost:11434/api/tags", {
      timeout: 10000,
    });

    return (tagsRes.data.models || [])
      .map((model) => model.name)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function buildModelCandidates(installedModels, requestedModel) {
  const preferred = [
    normalizeModelName(requestedModel),
    normalizeModelName(process.env.OLLAMA_MODEL),
    "llama3.1:latest",
    "deepseek-r1:1.5b",
    "llama3.2",
  ].filter(Boolean);

  const installedSet = new Set(installedModels);
  const ordered = [];

  for (const name of preferred) {
    if (installedSet.has(name) && !ordered.includes(name)) {
      ordered.push(name);
    }
  }

  for (const name of installedModels) {
    if (!ordered.includes(name)) {
      ordered.push(name);
    }
  }

  if (!ordered.length && preferred.length) {
    return preferred;
  }

  return ordered;
}

async function generateWithModel(model, prompt, forceCpu = false) {
  const payload = {
    model,
    stream: false,
    prompt,
  };

  if (forceCpu) {
    payload.options = { num_gpu: 0 };
  }

  const aiRes = await axios.post(
    "http://localhost:11434/api/generate",
    payload,
    { timeout: 120000 },
  );

  return aiRes.data.response;
}


async function generateProjectSummary(prompt, requestedModel) {
  const installedModels = await getInstalledModelNames();
  const candidates = buildModelCandidates(installedModels, requestedModel);
  const attemptErrors = [];

  for (const model of candidates) {
    try {
      const response = await generateWithModel(model, prompt, false);
      return { response, modelUsed: model };
    } catch (error) {
      const details =
        error?.response?.data?.error || error?.message || "Unknown AI failure";

      if (isCudaRuntimeFailure(error)) {
        try {
          const response = await generateWithModel(model, prompt, true);
          return { response, modelUsed: `${model} (CPU fallback)` };
        } catch (cpuError) {
          const cpuDetails =
            cpuError?.response?.data?.error ||
            cpuError?.message ||
            "Unknown AI failure";
          attemptErrors.push(`${model} GPU failed: ${details}`);
          attemptErrors.push(`${model} CPU fallback failed: ${cpuDetails}`);
          continue;
        }
      }

      attemptErrors.push(`${model} failed: ${details}`);
    }
  }

  const fallbackModel = await getBestAvailableModel();
  if (fallbackModel && !candidates.includes(fallbackModel)) {
    try {
      const response = await generateWithModel(fallbackModel, prompt, false);
      return { response, modelUsed: fallbackModel };
    } catch (error) {
      const details =
        error?.response?.data?.error || error?.message || "Unknown AI failure";
      attemptErrors.push(`${fallbackModel} failed: ${details}`);
    }
  }

  throw new Error(
    attemptErrors.length
      ? `All candidate models failed. ${attemptErrors.join(" | ")}`
      : "No Ollama model available. Pull one first (example: deepseek-r1:1.5b)",
  );
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


app.get("/project-meta", async (req, res) => {
  const folderPath = req.query.path;

  if (!folderPath || typeof folderPath !== "string") {
    return res.status(400).json({ error: "Missing path query parameter" });
  }

  try {
    const projectRoot = toProjectRoot(folderPath);
    const stats = fs.statSync(projectRoot);

    return res.json({
      projectRoot,
      createdAt: stats.birthtime ? stats.birthtime.toISOString() : null,
      lastModifiedAt: stats.mtime ? stats.mtime.toISOString() : null,
    });
  } catch {
    return res.status(500).json({ error: "Failed to read project metadata" });
  }
});

app.post("/delete", async (req, res) => {
  const { folder } = req.body;

  if (!folder || typeof folder !== "string") {
    return res
      .status(400)
      .json({ success: false, error: "Missing folder path" });
  }

  const relative = path.relative(rootPath, folder);
  const isInsideRoot =
    relative && !relative.startsWith("..") && !path.isAbsolute(relative);

  if (!isInsideRoot) {
    return res
      .status(400)
      .json({ success: false, error: "Folder is outside selected root" });
  }

  const ok = await deleteFolder(folder);
  return res.json({ success: ok });
});


app.post("/describe", async (req, res) => {
  const { folder, model: requestedModel } = req.body;

  if (!folder || typeof folder !== "string") {
    return res.status(400).json({ error: "Missing folder path" });
  }

  try {
    const analysisRoot = toProjectRoot(folder);
    const projectStats = fs.statSync(analysisRoot);
    const projectName = path.basename(analysisRoot);
    const createdAt = projectStats.birthtime
      ? projectStats.birthtime.toISOString()
      : null;
    const lastModifiedAt = projectStats.mtime
      ? projectStats.mtime.toISOString()
      : null;
    const projectSizeBytes = getFolderSizeBytes(analysisRoot);
    const projectSizeReadable = formatBytes(projectSizeBytes);

    const { text: projectText, tags: detectedTags } =
      readProjectFiles(analysisRoot);

    if (!projectText || !projectText.trim()) {
      return res.status(400).json({
        error:
          "No analyzable project files found (README, package.json, pyproject.toml, requirements.txt, pom.xml, build.gradle, etc.)",
      });
    }

    const prompt = `You are an expert software analyst. Read the following project metadata (README and package.json summary) and provide a short plain-language summary about the project.

STRICT OUTPUT RULES:
- Do NOT include any code snippets.
- Do NOT include markdown code blocks.
- Do NOT quote file contents.
- Keep it concise and beginner-friendly.
- Do NOT repeat project name, created date, last modified date, project size, or tags.
- Do NOT add a "Project metadata" section or any other metadata summary.
- Use exactly these three numbered sections, each on its own line:
1) What this project is for: ...
2) How it works at a high level: ...
3) Main technologies/frameworks: ...
- Keep each section short and easy to scan.

Include only:
1) What this project is for
2) How it works at a high level
3) Main technologies/frameworks 

PROJECT INFO:
- Project name: ${projectName}
- Created date: ${createdAt || "Unknown"}
- Last modified date: ${lastModifiedAt || "Unknown"}
- Project size: ${projectSizeReadable} (${projectSizeBytes} bytes)
- Tags: ${detectedTags.length ? detectedTags.join(", ") : "unknown"}

PROJECT METADATA:
${projectText}`;

    const { response: aiText, modelUsed } = await generateProjectSummary(
      prompt,
      requestedModel,
    );

    const description = sanitizeDescription(aiText);

    return res.json({
      description,
      modelUsed,
      projectMeta: {
        projectName,
        createdAt,
        lastModifiedAt,
        projectSizeBytes,
        projectSizeReadable,
        tags: detectedTags,
      },
    });
  } catch (error) {
    const details =
      error?.response?.data?.error ||
      error?.message ||
      "Unknown AI analysis failure";

    return res.status(500).json({ error: `AI analysis failed: ${details}` });
  }
});


const PORT = 3001;
app.listen(PORT, () => console.log("Backend running on port", PORT));