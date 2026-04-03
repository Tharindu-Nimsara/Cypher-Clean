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