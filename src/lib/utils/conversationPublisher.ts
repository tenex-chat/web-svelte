import { NDKEvent } from '@nostr-dev-kit/ndk';
import type { NDKSvelte } from '@nostr-dev-kit/svelte';
import { toastStore } from '$lib/stores/toast.svelte';

/**
 * Publishes conversation metadata events (kind 513)
 */
export class ConversationPublisher {
	constructor(private ndk: NDKSvelte) {}

	private async publishMetadata(
		rootEventId: string,
		metadataTag: [string, string],
		successMessage: string,
		errorMessage: string
	): Promise<boolean> {
		if (!this.ndk || !metadataTag[1].trim()) {
			return false;
		}

		try {
			const metadataEvent = new NDKEvent(this.ndk);
			metadataEvent.kind = 513; // Conversation metadata kind
			metadataEvent.content = ''; // Content should be empty for kind:513
			metadataEvent.tags = [['e', rootEventId], metadataTag];

			await metadataEvent.publish();
			toastStore.success(successMessage);
			return true;
		} catch (error) {
			console.error(errorMessage, error);
			toastStore.error(errorMessage);
			return false;
		}
	}

	async updateTitle(rootEventId: string, title: string): Promise<boolean> {
		return this.publishMetadata(
			rootEventId,
			['title', title.trim()],
			'Title updated successfully',
			'Failed to update title'
		);
	}

	async updateSummary(rootEventId: string, summary: string): Promise<boolean> {
		return this.publishMetadata(
			rootEventId,
			['summary', summary.trim()],
			'Summary published successfully',
			'Failed to publish summary'
		);
	}
}
