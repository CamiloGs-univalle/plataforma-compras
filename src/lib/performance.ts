// ─── PERFORMANCE AUDIT UTILITIES ──────────────────────
// Lighthouse-style performance metrics

export interface PerformanceMetrics {
  fcp: number;  // First Contentful Paint
  lcp: number;  // Largest Contentful Paint
  cls: number;  // Cumulative Layout Shift
  fid: number;  // First Input Delay
  ttfb: number; // Time to First Byte
  si: number;   // Speed Index
}

export interface PerformanceReport {
  url: string;
  timestamp: string;
  metrics: PerformanceMetrics;
  score: number;
  recommendations: string[];
}

// ─── PERFORMANCE OBSERVER ─────────────────────────────
let performanceObserver: PerformanceObserver | null = null;

export function initPerformanceObserver(): void {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

  performanceObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'largest-contentful-paint') {
        console.log('LCP:', entry.startTime);
      }
      if (entry.entryType === 'first-input') {
        console.log('FID:', (entry as any).processingStart - entry.startTime);
      }
      if (entry.entryType === 'layout-shift') {
        console.log('CLS:', (entry as any).value);
      }
    }
  });

  performanceObserver.observe({ type: 'largest-contentful-paint', buffered: true });
  performanceObserver.observe({ type: 'first-input', buffered: true });
  performanceObserver.observe({ type: 'layout-shift', buffered: true });
}

export function disconnectPerformanceObserver(): void {
  performanceObserver?.disconnect();
}

// ─── METRICS COLLECTOR ────────────────────────────────
export function collectMetrics(): Partial<PerformanceMetrics> {
  if (typeof window === 'undefined') return {};

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  const paint = performance.getEntriesByType('paint');

  return {
    ttfb: navigation ? navigation.responseStart - navigation.requestStart : 0,
    fcp: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
  };
}

// ─── LAZY LOADING UTILITIES ───────────────────────────
export function lazyLoadImage(img: HTMLImageElement, src: string): void {
  if ('loading' in HTMLImageElement.prototype) {
    img.src = src;
  } else {
    // Fallback for older browsers
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          img.src = src;
          observer.unobserve(img);
        }
      });
    });
    observer.observe(img);
  }
}

// ─── DEBOUNCE UTILITY ─────────────────────────────────
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// ─── THROTTLE UTILITY ─────────────────────────────────
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ─── PERFORMANCE BUDGET CHECKER ───────────────────────
const PERFORMANCE_BUDGETS = {
  fcp: 1800,   // 1.8s
  lcp: 2500,   // 2.5s
  cls: 0.1,    // 0.1
  fid: 100,    // 100ms
  ttfb: 800,   // 800ms
};

export function checkPerformanceBudget(metrics: Partial<PerformanceMetrics>): {
  passed: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (metrics.fcp && metrics.fcp > PERFORMANCE_BUDGETS.fcp) {
    issues.push(`FCP (${metrics.fcp.toFixed(0)}ms) exceeds budget (${PERFORMANCE_BUDGETS.fcp}ms)`);
  }
  if (metrics.lcp && metrics.lcp > PERFORMANCE_BUDGETS.lcp) {
    issues.push(`LCP (${metrics.lcp.toFixed(0)}ms) exceeds budget (${PERFORMANCE_BUDGETS.lcp}ms)`);
  }
  if (metrics.cls && metrics.cls > PERFORMANCE_BUDGETS.cls) {
    issues.push(`CLS (${metrics.cls.toFixed(3)}) exceeds budget (${PERFORMANCE_BUDGETS.cls})`);
  }
  if (metrics.fid && metrics.fid > PERFORMANCE_BUDGETS.fid) {
    issues.push(`FID (${metrics.fid}ms) exceeds budget (${PERFORMANCE_BUDGETS.fid}ms)`);
  }
  if (metrics.ttfb && metrics.ttfb > PERFORMANCE_BUDGETS.ttfb) {
    issues.push(`TTFB (${metrics.ttfb.toFixed(0)}ms) exceeds budget (${PERFORMANCE_BUDGETS.ttfb}ms)`);
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}
