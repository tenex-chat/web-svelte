<script lang="ts">
	import { MoreHorizontal, FileText, Bug, ExternalLink } from 'lucide-svelte';
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import type { Message } from '$lib/utils/messageUtils';
	import { ndk } from '$lib/ndk.svelte';
	import { aiService } from '$lib/services/ai-service';
	import { ConversationPublisher } from '$lib/utils/conversationPublisher';
	import { aiConfigStore } from '$lib/stores/aiConfig.svelte';
	import { toastStore } from '$lib/stores/toast.svelte';
	import type { ProviderConfig } from '$lib/services/provider-registry';
	import { clickOutside } from '$lib/utils/clickOutside';
	import { windowManager } from '$lib/stores/windowManager.svelte';

	interface Props {
		rootEvent: NDKEvent;
		messages: Message[];
	}

	let { rootEvent, messages }: Props = $props();

	let isSummarizing = $state(false);
	let isOpen = $state(false);

	// Special config IDs that mean "use active config"
	const USE_ACTIVE_CONFIG_IDS = ['active', 'default'];

	// Resolve the actual config ID to use
	function resolveConfigId(configId: string | undefined): string | null {
		if (!configId || USE_ACTIVE_CONFIG_IDS.includes(configId)) {
			return aiConfigStore.config.activeLLMConfigId;
		}
		return configId;
	}

	// Get summary LLM config
	const summaryLLMConfig = $derived.by(() => {
		const configId = resolveConfigId(aiConfigStore.config.uiLLMConfigs.summaries);
		if (configId) {
			return aiConfigStore.config.llmConfigs.find((c) => c.id === configId);
		}
		// Fallback to first config if available
		return aiConfigStore.config.llmConfigs[0];
	});
	const hasSummaryProvider = $derived(!!summaryLLMConfig);

	// Convert LLMConfig to ProviderConfig
	function toProviderConfig(llmConfig: typeof summaryLLMConfig): ProviderConfig | undefined {
		if (!llmConfig) {
			console.error('No LLM config provided');
			return undefined;
		}

		if (!llmConfig.provider) {
			console.error('LLM config missing provider field:', llmConfig);
			toastStore.error('LLM configuration is incomplete - missing provider');
			return undefined;
		}

		if (llmConfig.provider === 'custom') {
			toastStore.error('Custom providers are not supported for summarization');
			return undefined;
		}

		if (!llmConfig.apiKey) {
			toastStore.error('LLM configuration is missing API key');
			return undefined;
		}

		return {
			id: llmConfig.id,
			provider: llmConfig.provider,
			model: llmConfig.model,
			apiKey: llmConfig.apiKey,
			baseURL: llmConfig.baseUrl
		};
	}

	function handleClickOutside() {
		isOpen = false;
	}

	function handleDebugEvents() {
		isOpen = false;
		windowManager.open({
			type: 'debug-events',
			title: `Debug Events - ${rootEvent.id.slice(0, 8)}`,
			data: { rootEvent }
		});
	}

	function handleOpenTraces() {
		isOpen = false;
		const conversationId = rootEvent.id;
		const tracesUrl = `http://localhost:16686/search?service=tenex-daemon&tags=%7B%22conversation.id%22%3A%22${conversationId}%22%7D`;
		window.open(tracesUrl, '_blank');
	}

	function handleOpenTrace() {
		isOpen = false;
		const traceId = rootEvent.id.slice(0, 32);
		const traceUrl = `http://localhost:16686/trace/${traceId}`;
		window.open(traceUrl, '_blank');
	}

	async function handleSummarize() {
		if (!hasSummaryProvider) {
			toastStore.error(
				'Please configure a summary LLM in Settings > AI Settings > UI Features Configuration'
			);
			return;
		}

		isOpen = false;
		isSummarizing = true;
		try {
			const messagesToSummarize = await Promise.all(
				messages.map(async (msg) => {
					let authorName = 'Unknown';
					const authorPubkey = msg.event.pubkey;
					if (authorPubkey && ndk) {
						try {
							const user = ndk.getUser({ pubkey: authorPubkey });
							await user.fetchProfile();
							authorName =
								user.profile?.displayName ||
								user.profile?.name ||
								`${authorPubkey.slice(0, 8)}...`;
						} catch (error) {
							console.warn('Failed to fetch user profile:', error);
							authorName = `${authorPubkey.slice(0, 8)}...`;
						}
					}
					return {
						author: authorName,
						content: msg.event.content || '',
						timestamp: msg.event.created_at
					};
				})
			);

			if (messagesToSummarize.length === 0) {
				toastStore.error('No message content to summarize');
				return;
			}

			const providerConfig = toProviderConfig(summaryLLMConfig);
			if (!providerConfig) {
				return;
			}

			const summary = await aiService.summarizeConversation(messagesToSummarize, providerConfig);

			if (summary) {
				const publisher = new ConversationPublisher(ndk);
				await publisher.updateSummary(rootEvent.id, summary);
			}
		} catch (error) {
			console.error('Error generating summary:', error);
			if (error instanceof Error) {
				if (error.message.includes('No AI provider')) {
					toastStore.error('Please configure an LLM in Settings > AI Settings');
				} else if (error.message.includes('API key')) {
					toastStore.error('Invalid or missing API key for the selected LLM');
				} else {
					toastStore.error(`Summarization failed: ${error.message}`);
				}
			} else {
				toastStore.error('Failed to summarize conversation');
			}
		} finally {
			isSummarizing = false;
		}
	}
</script>

<div class="relative">
	<button
		type="button"
		onclick={() => (isOpen = !isOpen)}
		class="p-2 rounded-lg hover:bg-muted transition-colors"
		title="Thread options"
		aria-label="Thread options"
	>
		<MoreHorizontal class="w-4 h-4 text-muted-foreground" />
	</button>

	{#if isOpen}
		<div
			use:clickOutside={handleClickOutside}
			class="absolute right-0 top-full mt-1 w-48 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50"
		>
			<button
				type="button"
				onclick={handleSummarize}
				disabled={isSummarizing || !hasSummaryProvider}
				class="w-full text-left px-3 py-2 hover:bg-muted transition-colors flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
			>
				<FileText class="w-4 h-4" />
				<span>{isSummarizing ? 'Summarizing...' : 'Summarize'}</span>
			</button>
			<button
				type="button"
				onclick={handleDebugEvents}
				class="w-full text-left px-3 py-2 hover:bg-muted transition-colors flex items-center gap-2 text-sm"
			>
				<Bug class="w-4 h-4" />
				<span>Debug Events</span>
			</button>
			<button
				type="button"
				onclick={handleOpenTrace}
				class="w-full text-left px-3 py-2 hover:bg-muted transition-colors flex items-center gap-2 text-sm"
			>
				<ExternalLink class="w-4 h-4" />
				<span>Open trace</span>
			</button>
			<button
				type="button"
				onclick={handleOpenTraces}
				class="w-full text-left px-3 py-2 hover:bg-muted transition-colors flex items-center gap-2 text-sm"
			>
				<ExternalLink class="w-4 h-4" />
				<span>Open Traces</span>
			</button>
		</div>
	{/if}
</div>
