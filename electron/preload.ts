import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
	platform: process.platform,
	isElectron: true,
	ipcRenderer: {
		send: (channel: string, data: unknown) => {
			const validChannels = ['open-window'];
			if (validChannels.includes(channel)) {
				ipcRenderer.send(channel, data);
			}
		}
	}
});
