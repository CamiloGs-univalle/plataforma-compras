import { render, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

// ─── ACCESSIBILITY TEST UTILITIES ─────────────────────
// WCAG 2.1 Compliance Testing

describe('Accessibility Tests', () => {
  beforeEach(() => {
    // Mock window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  describe('Button Component', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <button className="btn btn-primary">Click me</button>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper aria-label when loading', async () => {
      const { container } = render(
        <button className="btn btn-primary" disabled aria-busy="true">
          Loading...
        </button>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Card Component', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <div className="card">
          <h3>Card Title</h3>
          <p>Card content</p>
        </div>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Badge Component', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <span className="badge badge-success">Active</span>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Input Component', () => {
    it('should have no accessibility violations with label', async () => {
      const { container } = render(
        <div>
          <label htmlFor="test-input">Email</label>
          <input id="test-input" type="email" className="input" />
        </div>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have aria-describedby for helper text', async () => {
      const { container } = render(
        <div>
          <label htmlFor="test-input">Email</label>
          <input id="test-input" type="email" className="input" aria-describedby="helper" />
          <span id="helper">Enter your email</span>
        </div>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Modal Component', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <div role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <h2 id="modal-title">Modal Title</h2>
          <p>Modal content</p>
          <button aria-label="Close modal">×</button>
        </div>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Table Component', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>John Doe</td>
              <td>john@example.com</td>
            </tr>
          </tbody>
        </table>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Color Contrast', () => {
    it('should verify color contrast ratios', () => {
      // Test color combinations
      const combinations = [
        { fg: '#ffffff', bg: '#2563eb', expected: true },  // White on blue
        { fg: '#000000', bg: '#ffffff', expected: true },  // Black on white
        { fg: '#ffffff', bg: '#ef4444', expected: true },  // White on red
        { fg: '#666666', bg: '#ffffff', expected: false },  // Gray on white (low contrast)
      ];

      combinations.forEach(({ fg, bg, expected }) => {
        const ratio = getContrastRatio(fg, bg);
        const meets = ratio >= 4.5;
        expect(meets).toBe(expected);
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support Enter key activation', async () => {
      const onClick = jest.fn();
      const { container } = render(
        <button onClick={onClick}>Click me</button>
      );
      
      const button = container.querySelector('button');
      fireEvent.keyDown(button!, { key: 'Enter' });
      
      expect(onClick).toHaveBeenCalled();
    });

    it('should support Escape key to close', async () => {
      const onClose = jest.fn();
      const { container } = render(
        <div role="dialog" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
          <button>Close</button>
        </div>
      );
      
      fireEvent.keyDown(container.querySelector('div')!, { key: 'Escape' });
      
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('ARIA Labels', () => {
    it('should have proper aria-labels on interactive elements', async () => {
      const { container } = render(
        <div>
          <button aria-label="Close dialog">×</button>
          <input aria-label="Search" type="text" />
          <select aria-label="Select role">
            <option>Admin</option>
          </select>
        </div>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});

// Helper functions
function getContrastRatio(hex1: string, hex2: string): number {
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
