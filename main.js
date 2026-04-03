const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");

// Start Express server
require("./backend/server.js");

ipcMain.handle("select-folder", async (event) => {
  try {
    const parentWindow =
      BrowserWindow.fromWebContents(event.sender) || undefined;
    const result = await dialog.showOpenDialog(parentWindow, {
      properties: ["openDirectory"],
    });

    if (result.canceled || !result.filePaths?.length) {
      return null;
    }

    return result.filePaths[0];
  } catch {
    return null;
  }
});

ipcMain.handle("open-folder", async (_event, folderPath) => {
  if (!folderPath || typeof folderPath !== "string") {
    return { success: false, error: "Missing folder path" };
  }

  try {
    const result = await shell.openPath(folderPath);
    if (result) {
      return { success: false, error: result };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error?.message || "Failed to open folder" };
  }
});