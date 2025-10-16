"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electron", {
  platform: process.platform,
  isElectron: true,
  ipcRenderer: {
    send: (channel, data) => {
      const validChannels = ["open-window"];
      if (validChannels.includes(channel)) {
        electron.ipcRenderer.send(channel, data);
      }
    }
  }
});
