// ─── ACCESSIBILITY TESTING UTILITIES ──────────────────
// WCAG 2.1 Compliance Testing

export interface A11yIssue {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  help: string;
  helpUrl: string;
  tags: string[];
  target: string[];
}

export interface A11yReport {
  url: string;
  timestamp: string;
  issues: A11yIssue[];
  score: number;
  passes: number;
  violations: number;
}

// ─── COLOR CONTRAST CHECKER ───────────────────────────
export function getContrastRatio(hex1: string, hex2: string): number {
  const getLuminance = (hex: string): number => {
    const rgb = hex.replace('#', '').match(/.{2}/g)?.map(x => {
      const val = parseInt(x, 16) / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    }) || [0, 0, 0];
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  };

  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsWCAG(hex1: string, hex2: string, level: 'AA' | 'AAA' = 'AA'): boolean {
  const ratio = getContrastRatio(hex1, hex2);
  return level === 'AA' ? ratio >= 4.5 : ratio >= 7;
}

// ─── FOCUS TRAP DETECTOR ──────────────────────────────
export function trapFocus(element: HTMLElement): void {
  const focusableElements = element.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus();
        e.preventDefault();
      }
    }
  };

  element.addEventListener('keydown', handleKeyDown);
  firstElement?.focus();
}

// ─── SCREEN READER ANNOUNCER ──────────────────────────
let announcer: HTMLDivElement | null = null;

export function announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  if (!announcer) {
    announcer = document.createElement('div');
    announcer.setAttribute('aria-live', priority);
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'sr-only';
    document.body.appendChild(announcer);
  }
  announcer.textContent = message;
}

// ─── KEYBOARD NAVIGATION HELPER ───────────────────────
export function handleKeyboardNavigation(
  e: React.KeyboardEvent,
  actions: Record<string, () => void>
): void {
  const action = actions[e.key];
  if (action) {
    e.preventDefault();
    action();
  }
}

// ─── ARIA LABEL GENERATOR ─────────────────────────────
export function generateAriaLabel(options: {
  action?: string;
  subject?: string;
  state?: string;
  count?: number;
}): string {
  const parts: string[] = [];
  if (options.action) parts.push(options.action);
  if (options.subject) parts.push(options.subject);
  if (options.state) parts.push(options.state);
  if (options.count !== undefined) parts.push(`${options.count} elementos`);
  return parts.join(' ');
}

// ─── REDUCED MOTION CHECKER ───────────────────────────
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ─── HIGH CONTRAST MODE CHECKER ───────────────────────
export function prefersHighContrast(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(forced-colors: active)').matches;
}
