# Cypher Clean

## Project Demo video: https://drive.google.com/file/d/1e_PZ4f3g-UFyXhzwkljuLmxYPdQmRK8f/view?usp=sharing

Cypher Clean is a privacy-first desktop assistant for developers that helps identify and clean auto-generated project folders (such as node_modules, venv, .venv, .next, and target), while also generating local AI-powered project summaries.

## Problem Statement

Developers waste storage, time, and productivity managing auto-generated project files scattered across their systems.
Developers need a way to intelligently manage, clean, and understand their project environments while maintaining privacy and security.

## Proposed Solution

Cypher Clean is a privacy-first developer assistant that scans projects to detect unnecessary environment and build files, frees up storage, and uses local AI to generate smart project summaries entirely offline.
No cloud, no data leakage, just fast, secure, on-device optimization for developers.

## Objectives

- Detect common generated folders across mixed-language repositories.
- Help developers reclaim disk space safely.
- Provide quick project understanding using local AI summaries.
- Keep all analysis on-device to protect source code privacy.

## Team Details

- Team name: Cypher Sentinel
- Team members: Tharindu Nimsara (Leader), Anushka Rodrigo, Gavesh Mithila
- University: University of Sri Jayewardenepura
- Selected domain: Responsible AI, Ethics & Future of Work

## Technology Stack

### Desktop and Frontend

- Electron (desktop shell)
- HTML, CSS, JavaScript (renderer UI)

### Backend Services

- Node.js
- Express.js
- CORS
- Axios

### AI and Local Inference

- Ollama (local model serving)
- Example local models: llama3.1, deepseek-r1

### Supported Cleanup Targets

- Node.js: node_modules
- Python: venv, .venv
- Next.js: .next
- Java: target

## Architecture Overview

Cypher Clean follows a local-first desktop architecture:

1. Electron Main Process

- Starts the desktop window.
- Starts the local Express backend.
- Provides secure IPC APIs for folder selection and opening folders.

2. Renderer (Frontend)

- Shows controls, results table, filtering, sorting, and modals.
- Calls backend HTTP APIs on localhost.
- Calls Electron preload APIs for native desktop actions.

3. Local Backend (Express)

- Scans directories recursively.
- Calculates folder sizes.
- Reads project metadata.
- Deletes selected generated folders.
- Builds AI prompt and generates summary using local Ollama.

4. Local AI Runtime

- Uses Ollama HTTP API.
- Attempts model fallback and CPU fallback when needed.
- Returns concise project analysis without sending code to cloud services.

## Core Features

- Folder picker and project root scanning
- Recursive detection of generated folders
- Folder size calculation
- Project metadata extraction (created and modified dates)
- Delete confirmation workflow
- Project folder open action from the app
- AI project summary modal with metadata cards
- Type filtering (Node, Python, Java, Next) and sorting options

## Algorithms and Logic Used

- Recursive DFS traversal for scanning folder trees
- Recursive aggregation for folder size computation
- Set-based matching for target and ignored folder names
- Path normalization and boundary checks for safe deletion
- Candidate ranking and fallback strategy for local AI model selection
- Regex-based sanitization and structured parsing of summary output

## API Endpoints

The local backend provides the following endpoints:

- GET /scan?path=<selectedPath>
- GET /size?path=<folderPath>
- GET /project-meta?path=<folderPath>
- POST /delete
- POST /describe

## Privacy and Security

- Local-first processing by design.
- Project analysis is generated using local Ollama models.
- No mandatory cloud dependency for core operations.
- Renderer is isolated with contextIsolation enabled in Electron.
- Deletion requests are checked to ensure target path is inside selected root.

## Project Structure

```
project-file/
  main.js
  package.json
  backend/
    server.js
    scan.js
    describe.js
  frontend/
    index.html
    style.css
    app.js
    preload.js
```

## Prerequisites

- Node.js (LTS recommended)
- npm
- Windows, macOS, or Linux desktop environment
- Ollama installed and running for AI summary feature
- At least one local Ollama model pulled

## How to Run the Project

1. Open CMD and Pull at least one AI model (if not already available)

```bash
ollama pull deepseek-r1:1.5b
```

2. Start Ollama service in CMD (required for AI summary)

```bash
ollama serve
```

3. In project folder terminal install dependencies

```bash
npm install
```

4. In project folder terminal start the Electron app

```bash
npm start
```

5. Use the app

- Click Choose Folder
- Select a root directory to scan
- Click Scan folders
- Review detected generated folders, sizes, and metadata
- Delete unnecessary folders or run Analyze for project summary

## Configuration Notes

- Default backend port is 3001.
- You can set preferred model with environment variable OLLAMA_MODEL.
- If GPU execution fails, the app attempts CPU fallback for model inference.

## Limitations

- Large directory trees may take time due to recursive scanning.
- AI analysis depends on availability of local Ollama models.
- Current implementation uses synchronous filesystem calls in key paths.

## Acknowledgements

- Electron and Express open-source communities
- Ollama for local inference tooling
