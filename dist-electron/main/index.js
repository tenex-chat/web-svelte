import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "path";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
let mainWindow = null;
const childWindows = /* @__PURE__ */ new Map();
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#000000",
    webPreferences: {
      preload: join(__dirname, "../preload/preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || process.env["ELECTRON_RENDERER_URL"];
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, "../../build/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
ipcMain.on("open-window", (event, { url, title, width, height }) => {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || process.env["ELECTRON_RENDERER_URL"];
  const win = new BrowserWindow({
    width: width || 800,
    height: height || 600,
    title: title || "Window",
    backgroundColor: "#000000",
    webPreferences: {
      preload: join(__dirname, "../preload/preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });
  if (devServerUrl) {
    win.loadURL(`${devServerUrl}${url}`);
  } else {
    const urlPath = url.startsWith("/") ? url.slice(1) : url;
    win.loadFile(join(__dirname, "../../build", urlPath));
  }
  const windowId = win.id;
  childWindows.set(windowId, win);
  win.on("closed", () => {
    childWindows.delete(windowId);
  });
});
