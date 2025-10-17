/**
 * Toast notification store using Svelte 5 runes
 */

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
	id: string;
	message: string;
	type: ToastType;
	duration?: number;
}

class ToastStore {
	toasts = $state<Toast[]>([]);

	show(message: string, type: ToastType = 'info', duration: number = 5000): string {
		const id = Math.random().toString(36).substr(2, 9);

		const toast: Toast = {
			id,
			message,
			type,
			duration
		};

		this.toasts = [...this.toasts, toast];

		if (duration > 0) {
			setTimeout(() => this.dismiss(id), duration);
		}

		return id;
	}

	dismiss(id: string): void {
		this.toasts = this.toasts.filter(t => t.id !== id);
	}

	info(message: string, duration?: number): string {
		return this.show(message, 'info', duration);
	}

	success(message: string, duration?: number): string {
		return this.show(message, 'success', duration);
	}

	warning(message: string, duration?: number): string {
		return this.show(message, 'warning', duration);
	}

	error(message: string, duration?: number): string {
		return this.show(message, 'error', duration);
	}

	clear(): void {
		this.toasts = [];
	}
}

export const toastStore = new ToastStore();
