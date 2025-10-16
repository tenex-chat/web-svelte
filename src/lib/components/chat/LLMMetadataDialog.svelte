<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { Info, X, Cpu, Zap, Hash, Settings, Activity } from 'lucide-svelte';

	interface Props {
		event: NDKEvent;
		onClose: () => void;
	}

	let { event, onClose }: Props = $props();

	// Extract LLM metadata from event tags
	const metadata = $derived.by(() => {
		const tags = event.tags;
		const data: Record<string, string> = {};

		// Extract all llm-* prefixed tags
		for (const tag of tags) {
			const tagName = tag[0];
			const tagValue = tag[1];

			if (!tagValue) continue;

			// Extract all llm-* tags
			if (tagName.startsWith('llm-')) {
				const key = tagName.slice(4); // Remove 'llm-' prefix
				data[key] = tagValue;
			}
		}

		return data;
	});

	const hasMetadata = $derived(Object.keys(metadata).length > 0);

	// Group metadata by category
	const groupedMetadata = $derived.by(() => {
		return {
			model: {
				icon: Cpu,
				title: 'Model Information',
				items: [
					{ key: 'model', label: 'Model', value: metadata.model },
					{ key: 'provider', label: 'Provider', value: metadata.provider },
					{ key: 'api-version', label: 'API Version', value: metadata['api-version'] },
					{ key: 'system-fingerprint', label: 'System Fingerprint', value: metadata['system-fingerprint'] }
				].filter((item) => item.value)
			},
			parameters: {
				icon: Settings,
				title: 'Generation Parameters',
				items: [
					{ key: 'temperature', label: 'Temperature', value: metadata.temperature },
					{ key: 'max-tokens', label: 'Max Tokens', value: metadata['max-tokens'] },
					{ key: 'top-p', label: 'Top P', value: metadata['top-p'] },
					{ key: 'frequency-penalty', label: 'Frequency Penalty', value: metadata['frequency-penalty'] },
					{ key: 'presence-penalty', label: 'Presence Penalty', value: metadata['presence-penalty'] }
				].filter((item) => item.value)
			},
			usage: {
				icon: Activity,
				title: 'Token Usage',
				items: [
					{ key: 'prompt-tokens', label: 'Prompt Tokens', value: metadata['prompt-tokens'] },
					{ key: 'completion-tokens', label: 'Completion Tokens', value: metadata['completion-tokens'] },
					{ key: 'total-tokens', label: 'Total Tokens', value: metadata['total-tokens'] },
					{ key: 'reasoning-tokens', label: 'Reasoning Tokens', value: metadata['reasoning-tokens'] },
					{ key: 'cached-input-tokens', label: 'Cached Input Tokens', value: metadata['cached-input-tokens'] }
				].filter((item) => item.value)
			},
			performance: {
				icon: Zap,
				title: 'Performance',
				items: [
					{ key: 'response-time', label: 'Response Time', value: metadata['response-time'] ? `${metadata['response-time']}ms` : undefined },
					{ key: 'finish-reason', label: 'Finish Reason', value: metadata['finish-reason'] },
					{ key: 'cost-usd', label: 'Cost (USD)', value: metadata['cost-usd'] ? `$${metadata['cost-usd']}` : undefined }
				].filter((item) => item.value)
			}
		};
	});

	function copyMetadata() {
		const text = JSON.stringify(metadata, null, 2);
		navigator.clipboard.writeText(text);
	}
</script>

<div
		class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
		onclick={onClose}
		onkeydown={(e) => {
			if (e.key === 'Escape') onClose();
		}}
		role="dialog"
		aria-modal="true"
		aria-labelledby="llm-metadata-title"
		tabindex="-1"
	>
		<div
			class="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
			onclick={(e) => e.stopPropagation()}
			role="document"
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-zinc-700">
				<div class="flex items-center gap-2">
					<Info class="w-5 h-5 text-blue-600" />
					<h3 id="llm-metadata-title" class="font-semibold text-gray-900 dark:text-gray-100">
						LLM Metadata
					</h3>
				</div>
				<button
					type="button"
					onclick={onClose}
					class="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
					aria-label="Close"
				>
					<X class="w-5 h-5 text-gray-500" />
				</button>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto p-4">
				{#if !hasMetadata}
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<Info class="w-12 h-12 text-gray-400 mb-3" />
						<p class="text-gray-600 dark:text-gray-400 text-sm">
							No LLM metadata found for this message
						</p>
						<p class="text-gray-500 dark:text-gray-500 text-xs mt-1">
							Metadata is typically attached by AI agents when generating responses
						</p>
					</div>
				{:else}
					<div class="space-y-4">
						{#each Object.entries(groupedMetadata) as [categoryKey, category]}
							{#if category.items.length > 0}
								<div class="border border-gray-200 dark:border-zinc-700 rounded-lg p-4">
									<div class="flex items-center gap-2 mb-3">
										<svelte:component
											this={category.icon}
											class="w-4 h-4 text-blue-600 dark:text-blue-400"
										/>
										<h4 class="font-medium text-sm text-gray-900 dark:text-gray-100">
											{category.title}
										</h4>
									</div>
									<dl class="space-y-2">
										{#each category.items as item}
											<div class="flex items-start justify-between gap-4 text-sm">
												<dt class="text-gray-600 dark:text-gray-400 font-medium min-w-[140px]">
													{item.label}:
												</dt>
												<dd class="text-gray-900 dark:text-gray-100 font-mono text-xs break-all">
													{item.value}
												</dd>
											</div>
										{/each}
									</dl>
								</div>
							{/if}
						{/each}
					</div>
				{/if}
			</div>

			<!-- Footer -->
			{#if hasMetadata}
				<div class="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-zinc-700">
					<button
						type="button"
						onclick={copyMetadata}
						class="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
					>
						Copy JSON
					</button>
				</div>
			{/if}
		</div>
	</div>
