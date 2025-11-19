/**
 * Central performance metrics store for tracking application performance
 */

import { untrack } from 'svelte';

export interface AccumulatorMetrics {
	totalEvents: number;
	fastPathHits: number;
	slowPathHits: number;
	totalReconstructTime: number;
	avgReconstructTime: number;
	maxContentLength: number;
	slowReconstructionCount: number; // >10ms
}

export interface ConversationStateMetrics {
	eventsProcessed: number;
	streamingEvents: number;
	displayMessagesComputations: number;
	displayMessagesComputeTime: number;
	avgComputeTime: number;
	lastComputeTime: number;
	slowComputationCount: number; // >50ms
}

export interface MessageRenderMetrics {
	renderCount: number;
	totalRenderTime: number;
	avgRenderTime: number;
	lastRenderTime: number;
	slowRenderCount: number; // >16ms (60fps threshold)
	markdownParseTime: number;
}

export interface AggregatedMetrics {
	accumulator: Map<string, AccumulatorMetrics>; // keyed by session ID
	conversationState: Map<string, ConversationStateMetrics>; // keyed by conversation ID
	messageRenders: MessageRenderMetrics;
	lastUpdateTime: number;
}

class PerformanceMetricsStore {
	private accumulatorMetrics = new Map<string, AccumulatorMetrics>();
	private conversationStateMetrics = new Map<string, ConversationStateMetrics>();

	// Message render metrics (global)
	messageRenderMetrics = $state<MessageRenderMetrics>({
		renderCount: 0,
		totalRenderTime: 0,
		avgRenderTime: 0,
		lastRenderTime: 0,
		slowRenderCount: 0,
		markdownParseTime: 0
	});

	// Reactive state for UI
	isEnabled = $state(false);
	lastUpdateTime = $state(Date.now());

	/**
	 * Update accumulator metrics for a specific session
	 */
	updateAccumulatorMetrics(sessionId: string, metrics: Partial<AccumulatorMetrics>): void {
		untrack(() => {
			const existing = this.accumulatorMetrics.get(sessionId) || {
				totalEvents: 0,
				fastPathHits: 0,
				slowPathHits: 0,
				totalReconstructTime: 0,
				avgReconstructTime: 0,
				maxContentLength: 0,
				slowReconstructionCount: 0
			};

			const updated = { ...existing, ...metrics };
			if (updated.totalEvents > 0) {
				updated.avgReconstructTime = updated.totalReconstructTime / updated.totalEvents;
			}

			this.accumulatorMetrics.set(sessionId, updated);
			this.lastUpdateTime = Date.now();
		});
	}

	/**
	 * Update conversation state metrics
	 */
	updateConversationStateMetrics(conversationId: string, metrics: Partial<ConversationStateMetrics>): void {
		untrack(() => {
			const existing = this.conversationStateMetrics.get(conversationId) || {
				eventsProcessed: 0,
				streamingEvents: 0,
				displayMessagesComputations: 0,
				displayMessagesComputeTime: 0,
				avgComputeTime: 0,
				lastComputeTime: 0,
				slowComputationCount: 0
			};

			const updated = { ...existing, ...metrics };
			if (updated.displayMessagesComputations > 0) {
				updated.avgComputeTime = updated.displayMessagesComputeTime / updated.displayMessagesComputations;
			}

			this.conversationStateMetrics.set(conversationId, updated);
			this.lastUpdateTime = Date.now();
		});
	}

	/**
	 * Update message render metrics
	 */
	updateMessageRenderMetrics(metrics: Partial<MessageRenderMetrics>): void {
		untrack(() => {
			this.messageRenderMetrics = { ...this.messageRenderMetrics, ...metrics };

			if (this.messageRenderMetrics.renderCount > 0) {
				this.messageRenderMetrics.avgRenderTime =
					this.messageRenderMetrics.totalRenderTime / this.messageRenderMetrics.renderCount;
			}

			this.lastUpdateTime = Date.now();
		});
	}

	/**
	 * Get all aggregated metrics
	 */
	getAggregatedMetrics(): AggregatedMetrics {
		return {
			accumulator: new Map(this.accumulatorMetrics),
			conversationState: new Map(this.conversationStateMetrics),
			messageRenders: { ...this.messageRenderMetrics },
			lastUpdateTime: this.lastUpdateTime
		};
	}

	/**
	 * Get summary statistics across all sessions
	 */
	getSummaryStats() {
		const accumulatorStats = {
			totalSessions: this.accumulatorMetrics.size,
			totalEvents: 0,
			totalFastPath: 0,
			totalSlowPath: 0,
			totalSlowReconstructions: 0,
			avgReconstructTime: 0
		};

		let totalReconstructTime = 0;
		let totalEvents = 0;

		for (const metrics of this.accumulatorMetrics.values()) {
			accumulatorStats.totalEvents += metrics.totalEvents;
			accumulatorStats.totalFastPath += metrics.fastPathHits;
			accumulatorStats.totalSlowPath += metrics.slowPathHits;
			accumulatorStats.totalSlowReconstructions += metrics.slowReconstructionCount;
			totalReconstructTime += metrics.totalReconstructTime;
			totalEvents += metrics.totalEvents;
		}

		if (totalEvents > 0) {
			accumulatorStats.avgReconstructTime = totalReconstructTime / totalEvents;
		}

		const conversationStats = {
			totalConversations: this.conversationStateMetrics.size,
			totalEventsProcessed: 0,
			totalStreamingEvents: 0,
			totalComputations: 0,
			totalSlowComputations: 0,
			avgComputeTime: 0
		};

		let totalComputeTime = 0;
		let totalComputations = 0;

		for (const metrics of this.conversationStateMetrics.values()) {
			conversationStats.totalEventsProcessed += metrics.eventsProcessed;
			conversationStats.totalStreamingEvents += metrics.streamingEvents;
			conversationStats.totalComputations += metrics.displayMessagesComputations;
			conversationStats.totalSlowComputations += metrics.slowComputationCount;
			totalComputeTime += metrics.displayMessagesComputeTime;
			totalComputations += metrics.displayMessagesComputations;
		}

		if (totalComputations > 0) {
			conversationStats.avgComputeTime = totalComputeTime / totalComputations;
		}

		return {
			accumulator: accumulatorStats,
			conversationState: conversationStats,
			messageRenders: { ...this.messageRenderMetrics }
		};
	}

	/**
	 * Clear all metrics
	 */
	reset(): void {
		this.accumulatorMetrics.clear();
		this.conversationStateMetrics.clear();
		this.messageRenderMetrics = {
			renderCount: 0,
			totalRenderTime: 0,
			avgRenderTime: 0,
			lastRenderTime: 0,
			slowRenderCount: 0,
			markdownParseTime: 0
		};
		this.lastUpdateTime = Date.now();
	}

	/**
	 * Toggle metrics collection
	 */
	toggle(): void {
		this.isEnabled = !this.isEnabled;
	}

	/**
	 * Enable metrics collection
	 */
	enable(): void {
		this.isEnabled = true;
	}

	/**
	 * Disable metrics collection
	 */
	disable(): void {
		this.isEnabled = false;
	}
}

export const performanceMetrics = new PerformanceMetricsStore();

// Make available in console for debugging
if (typeof window !== 'undefined') {
	(window as any).__performanceMetrics = performanceMetrics;
}
