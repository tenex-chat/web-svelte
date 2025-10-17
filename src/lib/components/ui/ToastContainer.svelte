<script lang="ts">
	import { toastStore, type Toast } from '$lib/stores/toast.svelte';
	import { X, Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-svelte';

	const toasts = $derived(toastStore.toasts);

	function getIcon(type: Toast['type']) {
		switch (type) {
			case 'success':
				return CheckCircle;
			case 'warning':
				return AlertTriangle;
			case 'error':
				return XCircle;
			default:
				return Info;
		}
	}

	function getColorClasses(type: Toast['type']): string {
		switch (type) {
			case 'success':
				return 'bg-green-500/90 text-white';
			case 'warning':
				return 'bg-yellow-500/90 text-white';
			case 'error':
				return 'bg-red-500/90 text-white';
			default:
				return 'bg-blue-500/90 text-white';
		}
	}
</script>

<div class="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
	{#each toasts as toast (toast.id)}
		{@const Icon = getIcon(toast.type)}
		<div
			class="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg max-w-md {getColorClasses(
				toast.type
			)} animate-in slide-in-from-right duration-300"
		>
			<Icon class="h-5 w-5 flex-shrink-0 mt-0.5" />
			<p class="flex-1 text-sm">{toast.message}</p>
			<button
				onclick={() => toastStore.dismiss(toast.id)}
				class="flex-shrink-0 hover:opacity-70 transition-opacity"
				aria-label="Dismiss"
			>
				<X class="h-4 w-4" />
			</button>
		</div>
	{/each}
</div>

<style>
	@keyframes slide-in-from-right {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	.animate-in {
		animation: slide-in-from-right 0.3s ease-out;
	}
</style>
