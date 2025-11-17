import { SvelteMap } from 'svelte/reactivity';
import type { MetadataField } from '$lib/utils/conversationMetadataProcessor';

interface ConversationMetadata {
	id: string;
	title?: MetadataField;
	summary?: MetadataField;
}

export interface ConversationMetadataResult {
	id: string;
	title: string | undefined;
	summary: string | undefined;
	hasTitle: boolean;
	hasSummary: boolean;
}

class ConversationMetadataStore {
	private metadata = $state(new SvelteMap<string, ConversationMetadata>());

	setMetadata(
		conversationId: string,
		data: {
			title?: MetadataField;
			summary?: MetadataField;
		}
	): void {
		const current = this.metadata.get(conversationId) || { id: conversationId };
		const updated = { ...current };

		if (data.title) {
			updated.title = data.title;
		}

		if (data.summary) {
			updated.summary = data.summary;
		}

		this.metadata.set(conversationId, updated);
	}

	getMetadata(conversationId: string): ConversationMetadata | undefined {
		return this.metadata.get(conversationId);
	}

	getConversationData(conversationId: string | undefined): ConversationMetadataResult {
		if (!conversationId) {
			return {
				id: '',
				title: undefined,
				summary: undefined,
				hasTitle: false,
				hasSummary: false
			};
		}

		const metadata = this.metadata.get(conversationId);

		return {
			id: conversationId,
			title: metadata?.title?.value,
			summary: metadata?.summary?.value,
			hasTitle: !!metadata?.title,
			hasSummary: !!metadata?.summary
		};
	}

	clearMetadata(): void {
		this.metadata.clear();
	}
}

export const conversationMetadataStore = new ConversationMetadataStore();
