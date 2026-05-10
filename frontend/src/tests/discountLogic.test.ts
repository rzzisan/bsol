import { computeSellingPrice } from '../lib/pricing';

describe('computeSellingPrice', () => {
  it('calculates selling price with percentage discount', () => {
    const result = computeSellingPrice(100, 20, 'percent');
    expect(result).toBe(80);
  });

  it('calculates selling price with amount discount', () => {
    const result = computeSellingPrice(100, 20, 'amount');
    expect(result).toBe(80);
  });

  it('returns 0 for excessive discount', () => {
    const result = computeSellingPrice(100, 200, 'amount');
    expect(result).toBe(0);
  });

  it('handles zero discount', () => {
    const result = computeSellingPrice(100, 0, 'percent');
    expect(result).toBe(100);
  });
});