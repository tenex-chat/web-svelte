import type { NDKEvent } from '@nostr-dev-kit/ndk';

/**
 * Accumulates delta content from streaming response events (kind:21111)
 * Handles out-of-order delivery by using sequence tags
 */
export class DeltaContentAccumulator {
	private deltas = new Map<number, string>();
	private cachedContent = '';
	private lastReconstructedSequence = 0;
	private highestContiguousSequence = -1; // Track the highest sequence without gaps

	/**
	 * Add a delta event and return the reconstructed content
	 * @param event - NDKEvent with kind:21111 and ["sequence", "N"] tag
	 * @returns Reconstructed full content from all deltas
	 */
	addEvent(event: NDKEvent): string {
		const sequenceTag = event.tags.find((t) => t[0] === 'sequence');
		const sequence = sequenceTag ? parseInt(sequenceTag[1]) : 0;

		console.log('[DeltaAccumulator] Adding event', {
			eventId: event.id,
			sequence,
			deltaContent: event.content?.substring(0, 50),
			deltaLength: event.content?.length,
			existingDeltas: this.deltas.size
		});

		// If no content, don't add
		if (!event.content) {
			return this.cachedContent;
		}

		this.deltas.set(sequence, event.content);

		// Optimize: If this is the next expected sequence, just append
		if (sequence === this.highestContiguousSequence + 1) {
			this.cachedContent += event.content;
			this.highestContiguousSequence = sequence;

			// Check if we can now append more sequences that were waiting
			while (this.deltas.has(this.highestContiguousSequence + 1)) {
				this.highestContiguousSequence++;
				// Note: content already in deltas map, just update pointer
			}
			this.lastReconstructedSequence = this.getHighestSequence();
		} else {
			// Out-of-order or gap detected, need full reconstruction
			this.cachedContent = this.reconstruct();
			this.lastReconstructedSequence = this.getHighestSequence();
			this.updateHighestContiguous();
		}

		console.log('[DeltaAccumulator] After adding', {
			totalDeltas: this.deltas.size,
			reconstructedLength: this.cachedContent.length,
			sequences: Array.from(this.deltas.keys()).sort((a, b) => a - b)
		});

		return this.cachedContent;
	}

	private reconstruct(): string {
		return Array.from(this.deltas.entries())
			.sort(([a], [b]) => a - b)
			.map(([, content]) => content)
			.join('');
	}

	private getHighestSequence(): number {
		return Math.max(...Array.from(this.deltas.keys()), 0);
	}

	hasSequenceGaps(): boolean {
		const sequences = Array.from(this.deltas.keys()).sort((a, b) => a - b);
		if (sequences.length === 0) return false;

		for (let i = 1; i < sequences.length; i++) {
			if (sequences[i] - sequences[i - 1] > 1) {
				return true;
			}
		}
		return false;
	}

	getMissingSequences(): number[] {
		const sequences = Array.from(this.deltas.keys()).sort((a, b) => a - b);
		const missing: number[] = [];

		if (sequences.length === 0) return missing;

		for (let i = 1; i < sequences.length; i++) {
			const gap = sequences[i] - sequences[i - 1];
			if (gap > 1) {
				for (let j = sequences[i - 1] + 1; j < sequences[i]; j++) {
					missing.push(j);
				}
			}
		}

		return missing;
	}

	private updateHighestContiguous(): void {
		const sequences = Array.from(this.deltas.keys()).sort((a, b) => a - b);
		if (sequences.length === 0) {
			this.highestContiguousSequence = -1;
			return;
		}

		// Find highest sequence without gaps from 0
		this.highestContiguousSequence = -1;
		for (const seq of sequences) {
			if (seq === this.highestContiguousSequence + 1) {
				this.highestContiguousSequence = seq;
			} else {
				break;
			}
		}
	}

	clear(): void {
		this.deltas.clear();
		this.lastReconstructedSequence = 0;
		this.highestContiguousSequence = -1;
		this.cachedContent = '';
	}

	getContent(): string {
		return this.cachedContent;
	}

	getDeltaCount(): number {
		return this.deltas.size;
	}
}
