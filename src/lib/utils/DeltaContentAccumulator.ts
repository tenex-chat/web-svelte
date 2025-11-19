import type { NDKEvent } from '@nostr-dev-kit/ndk';
import { performanceMetrics, type AccumulatorMetrics } from '$lib/stores/performance-metrics.svelte';

/**
 * Accumulates delta content from streaming response events (kind:21111)
 * Handles out-of-order delivery by using sequence tags
 */
export class DeltaContentAccumulator {
	private deltas = new Map<number, string>();
	private cachedContent = '';
	private lastReconstructedSequence = 0;
	private highestContiguousSequence = -1; // Track the highest sequence without gaps
	private sessionId: string;

	// Performance metrics
	private metrics = {
		totalEvents: 0,
		fastPathHits: 0,
		slowPathHits: 0,
		totalReconstructTime: 0,
		maxContentLength: 0,
		slowReconstructionCount: 0
	};

	constructor(sessionId: string) {
		this.sessionId = sessionId;
	}

	/**
	 * Add a delta event and return the reconstructed content
	 * @param event - NDKEvent with kind:21111 and ["sequence", "N"] tag
	 * @returns Reconstructed full content from all deltas
	 */
	addEvent(event: NDKEvent): string {
		const startTime = performance.now();
		const sequenceTag = event.tags.find((t) => t[0] === 'sequence');
		const sequence = sequenceTag ? parseInt(sequenceTag[1]) : 0;

		this.metrics.totalEvents++;

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
			this.metrics.fastPathHits++;
		} else {
			// Out-of-order or gap detected, need full reconstruction
			this.cachedContent = this.reconstruct();
			this.lastReconstructedSequence = this.getHighestSequence();
			this.updateHighestContiguous();
			this.metrics.slowPathHits++;
		}

		// Track reconstruction time and update metrics
		const reconstructTime = performance.now() - startTime;
		this.metrics.totalReconstructTime += reconstructTime;
		this.metrics.maxContentLength = Math.max(this.metrics.maxContentLength, this.cachedContent.length);

		if (reconstructTime > 10) {
			this.metrics.slowReconstructionCount++;
		}

		// Update global metrics if enabled
		if (performanceMetrics.isEnabled) {
			performanceMetrics.updateAccumulatorMetrics(this.sessionId, {
				...this.metrics,
				avgReconstructTime: this.metrics.totalReconstructTime / this.metrics.totalEvents
			});
		}

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

	/**
	 * Get performance metrics for this accumulator
	 */
	getMetrics(): AccumulatorMetrics {
		return {
			...this.metrics,
			avgReconstructTime: this.metrics.totalEvents > 0
				? this.metrics.totalReconstructTime / this.metrics.totalEvents
				: 0
		};
	}
}
