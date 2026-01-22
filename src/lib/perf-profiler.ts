/**
 * Main-thread performance profiler for debugging performance issues.
 * Tracks Svelte reactivity, NDK subscriptions, and UI frame timing.
 */

interface PerfEntry {
  name: string;
  duration: number;
  timestamp: number;
  extra?: Record<string, unknown>;
}

interface PerfStats {
  totalOperations: number;
  operationsByType: Record<string, number>;
  slowOperations: PerfEntry[];
  subscriptionStats: {
    active: number;
    totalEvents: number;
    updateCalls: number;
  };
  frameStats: {
    longFrames: number;
    avgFrameTime: number;
    maxFrameTime: number;
  };
}

class PerformanceProfiler {
  private stats: PerfStats = {
    totalOperations: 0,
    operationsByType: {},
    slowOperations: [],
    subscriptionStats: {
      active: 0,
      totalEvents: 0,
      updateCalls: 0,
    },
    frameStats: {
      longFrames: 0,
      avgFrameTime: 16.67,
      maxFrameTime: 0,
    },
  };

  private frameTimestamps: number[] = [];
  private rafId: number | null = null;
  private enabled = true;

  start() {
    if (!this.enabled || typeof window === 'undefined') return;

    console.log('[PERF PROFILER] Starting main-thread profiling');

    // Monitor long tasks using PerformanceObserver
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              console.warn(`[PERF] Long Task: ${entry.duration.toFixed(2)}ms`, entry);
              this.recordSlow('longTask', entry.duration, {
                name: entry.name,
                startTime: entry.startTime,
              });
            }
          }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        console.log('[PERF PROFILER] Long task observer not supported');
      }
    }

    // Monitor frame timing
    this.monitorFrames();

    // Log stats periodically
    setInterval(() => {
      this.logStats();
    }, 30000);

    // Expose to window for debugging
    (window as any).__PERF_PROFILER__ = this;
  }

  private monitorFrames() {
    let lastFrameTime = performance.now();

    const checkFrame = () => {
      const now = performance.now();
      const frameDuration = now - lastFrameTime;
      lastFrameTime = now;

      this.frameTimestamps.push(frameDuration);
      if (this.frameTimestamps.length > 100) {
        this.frameTimestamps.shift();
      }

      // Calculate stats
      const avg = this.frameTimestamps.reduce((a, b) => a + b, 0) / this.frameTimestamps.length;
      this.stats.frameStats.avgFrameTime = avg;
      this.stats.frameStats.maxFrameTime = Math.max(this.stats.frameStats.maxFrameTime, frameDuration);

      if (frameDuration > 50) {
        this.stats.frameStats.longFrames++;
        if (frameDuration > 100) {
          console.warn(`[PERF] Long frame: ${frameDuration.toFixed(2)}ms (avg: ${avg.toFixed(2)}ms)`);
        }
      }

      this.rafId = requestAnimationFrame(checkFrame);
    };

    this.rafId = requestAnimationFrame(checkFrame);
  }

  recordSlow(type: string, duration: number, extra?: Record<string, unknown>) {
    this.stats.totalOperations++;
    this.stats.operationsByType[type] = (this.stats.operationsByType[type] || 0) + 1;

    if (duration > 50) {
      this.stats.slowOperations.push({
        name: type,
        duration,
        timestamp: Date.now(),
        extra,
      });
      // Keep only last 100
      if (this.stats.slowOperations.length > 100) {
        this.stats.slowOperations.shift();
      }
    }
  }

  // Wrap a function to track its execution time
  wrap<T extends (...args: any[]) => any>(name: string, fn: T): T {
    return ((...args: any[]) => {
      const start = performance.now();
      const result = fn(...args);

      if (result instanceof Promise) {
        return result.finally(() => {
          const duration = performance.now() - start;
          if (duration > 10) {
            this.recordSlow(name, duration);
          }
        });
      } else {
        const duration = performance.now() - start;
        if (duration > 10) {
          this.recordSlow(name, duration);
        }
        return result;
      }
    }) as T;
  }

  trackSubscription(action: 'start' | 'stop' | 'event' | 'update') {
    switch (action) {
      case 'start':
        this.stats.subscriptionStats.active++;
        break;
      case 'stop':
        this.stats.subscriptionStats.active = Math.max(0, this.stats.subscriptionStats.active - 1);
        break;
      case 'event':
        this.stats.subscriptionStats.totalEvents++;
        break;
      case 'update':
        this.stats.subscriptionStats.updateCalls++;
        break;
    }
  }

  logStats() {
    if (this.stats.totalOperations === 0) return;

    console.log('[PERF PROFILER STATS]', JSON.stringify({
      totalOperations: this.stats.totalOperations,
      operationsByType: this.stats.operationsByType,
      subscriptions: this.stats.subscriptionStats,
      frames: {
        longFrames: this.stats.frameStats.longFrames,
        avgFrameTime: this.stats.frameStats.avgFrameTime.toFixed(2),
        maxFrameTime: this.stats.frameStats.maxFrameTime.toFixed(2),
      },
      recentSlowOps: this.stats.slowOperations.slice(-10),
    }, null, 2));
  }

  getStats() {
    return this.stats;
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.enabled = false;
  }
}

// Singleton instance
export const perfProfiler = new PerformanceProfiler();

// Auto-start in browser
if (typeof window !== 'undefined') {
  // Start profiler on DOMContentLoaded or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => perfProfiler.start());
  } else {
    perfProfiler.start();
  }
}
