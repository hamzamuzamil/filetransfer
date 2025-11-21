// Performance monitoring utilities for production

export class PerformanceMonitor {
  private static metrics: Map<string, number[]> = new Map();

  /**
   * Start a performance measurement
   */
  static startMeasurement(name: string): () => void {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration);
    };
  }

  /**
   * Record a metric
   */
  private static recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);

    // Keep only last 100 measurements
    const values = this.metrics.get(name)!;
    if (values.length > 100) {
      values.shift();
    }
  }

  /**
   * Get average for a metric
   */
  static getAverage(name: string): number {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return 0;

    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }

  /**
   * Get metrics summary
   */
  static getSummary(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const summary: Record<string, any> = {};

    this.metrics.forEach((values, name) => {
      if (values.length === 0) return;

      summary[name] = {
        avg: values.reduce((acc, val) => acc + val, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length,
      };
    });

    return summary;
  }

  /**
   * Clear all metrics
   */
  static clear(): void {
    this.metrics.clear();
  }

  /**
   * Monitor transfer speed
   */
  static calculateTransferMetrics(
    bytesTransferred: number,
    elapsedSeconds: number
  ): {
    speedMbps: number;
    speedMBps: number;
    formattedSpeed: string;
  } {
    const bitsPerSecond = (bytesTransferred * 8) / elapsedSeconds;
    const speedMbps = bitsPerSecond / (1024 * 1024);
    const speedMBps = bytesTransferred / elapsedSeconds / (1024 * 1024);

    let formattedSpeed: string;
    if (speedMBps < 1) {
      formattedSpeed = `${(speedMBps * 1024).toFixed(2)} KB/s`;
    } else if (speedMBps < 1024) {
      formattedSpeed = `${speedMBps.toFixed(2)} MB/s`;
    } else {
      formattedSpeed = `${(speedMBps / 1024).toFixed(2)} GB/s`;
    }

    return {
      speedMbps,
      speedMBps,
      formattedSpeed,
    };
  }
}

/**
 * Memory monitoring utilities
 */
export class MemoryMonitor {
  /**
   * Get current memory usage (if available)
   */
  static getMemoryUsage(): { used: number; total: number; percentage: number } | null {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.jsHeapSizeLimit,
        percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
      };
    }
    return null;
  }

  /**
   * Check if memory pressure is high
   */
  static isMemoryPressureHigh(): boolean {
    const usage = this.getMemoryUsage();
    if (!usage) return false;
    return usage.percentage > 80;
  }

  /**
   * Format bytes to human-readable string
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }
}

/**
 * Connection quality monitoring
 */
export class ConnectionMonitor {
  private static connectionType: string = 'unknown';
  private static effectiveType: string = 'unknown';
  private static downlink: number = 0;
  private static rtt: number = 0;

  static initialize(): void {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      this.connectionType = connection.type || 'unknown';
      this.effectiveType = connection.effectiveType || 'unknown';
      this.downlink = connection.downlink || 0;
      this.rtt = connection.rtt || 0;

      // Listen for changes
      connection.addEventListener('change', () => {
        this.connectionType = connection.type || 'unknown';
        this.effectiveType = connection.effectiveType || 'unknown';
        this.downlink = connection.downlink || 0;
        this.rtt = connection.rtt || 0;
      });
    }
  }

  static getConnectionInfo(): {
    type: string;
    effectiveType: string;
    downlink: number;
    rtt: number;
  } {
    return {
      type: this.connectionType,
      effectiveType: this.effectiveType,
      downlink: this.downlink,
      rtt: this.rtt,
    };
  }

  static isSlowConnection(): boolean {
    return this.effectiveType === 'slow-2g' || this.effectiveType === '2g';
  }
}

/**
 * Battery monitoring (for mobile devices)
 */
export class BatteryMonitor {
  private static batteryLevel: number = 1;
  private static isCharging: boolean = true;

  static async initialize(): Promise<void> {
    if ('getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery();
        this.batteryLevel = battery.level;
        this.isCharging = battery.charging;

        battery.addEventListener('levelchange', () => {
          this.batteryLevel = battery.level;
        });

        battery.addEventListener('chargingchange', () => {
          this.isCharging = battery.charging;
        });
      } catch (error) {
        console.warn('Battery API not available');
      }
    }
  }

  static getBatteryInfo(): { level: number; isCharging: boolean; isLowBattery: boolean } {
    return {
      level: this.batteryLevel,
      isCharging: this.isCharging,
      isLowBattery: this.batteryLevel < 0.2 && !this.isCharging,
    };
  }

  static shouldThrottle(): boolean {
    return this.batteryLevel < 0.15 && !this.isCharging;
  }
}

// Initialize monitors
if (typeof window !== 'undefined') {
  ConnectionMonitor.initialize();
  BatteryMonitor.initialize();
}

