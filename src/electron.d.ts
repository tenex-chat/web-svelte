interface Window {
	electron?: {
		platform: string;
		isElectron: boolean;
		ipcRenderer: {
			send: (channel: string, data: unknown) => void;
		};
	};
}
