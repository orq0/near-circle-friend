import { describe, expect, it } from 'vitest';
import { formatDistance, formatRadius, positionOnRadar } from './radar';

describe('positionOnRadar', () => {
  it('places the center at 50/50', () => {
    expect(positionOnRadar(0, 123, 1000)).toEqual({ xPct: 50, yPct: 50 });
  });

  it('maps cardinal bearings to the rim', () => {
    const north = positionOnRadar(1000, 0, 1000);
    expect(north.xPct).toBeCloseTo(50, 5);
    expect(north.yPct).toBeCloseTo(0, 5);
    const east = positionOnRadar(1000, 90, 1000);
    expect(east.xPct).toBeCloseTo(100, 5);
    expect(east.yPct).toBeCloseTo(50, 5);
    const south = positionOnRadar(1000, 180, 1000);
    expect(south.xPct).toBeCloseTo(50, 5);
    expect(south.yPct).toBeCloseTo(100, 5);
    const west = positionOnRadar(1000, 270, 1000);
    expect(west.xPct).toBeCloseTo(0, 5);
    expect(west.yPct).toBeCloseTo(50, 5);
  });

  it('scales by distance fraction', () => {
    const half = positionOnRadar(500, 0, 1000);
    expect(half.xPct).toBe(50);
    expect(half.yPct).toBe(25);
  });

  it('clamps out-of-range results inside the face', () => {
    const beyond = positionOnRadar(5000, 90, 1000);
    expect(beyond.xPct).toBeCloseTo(100, 5);
    expect(beyond.yPct).toBeCloseTo(50, 5);
    expect(positionOnRadar(-10, 0, 1000)).toEqual({ xPct: 50, yPct: 50 });
    expect(positionOnRadar(100, 0, 0)).toEqual({ xPct: 50, yPct: 50 });
  });

  it('matches the Coleen fixture quadrant', () => {
    const point = positionOnRadar(280.1, 45, 1000);
    expect(point.xPct).toBeGreaterThan(50);
    expect(point.yPct).toBeLessThan(50);
  });
});

describe('formatDistance', () => {
  it('formats meters below 1 km', () => {
    expect(formatDistance(280.1)).toBe('280 m');
    expect(formatDistance(0)).toBe('0 m');
  });

  it('formats kilometers at and above 1 km', () => {
    expect(formatDistance(1500)).toBe('1.5 km');
    expect(formatDistance(12000)).toBe('12 km');
  });

  it('renders invalid input as a dash', () => {
    expect(formatDistance(Number.NaN)).toBe('—');
    expect(formatDistance(-5)).toBe('—');
  });
});

describe('formatRadius', () => {
  it('formats selector labels', () => {
    expect(formatRadius(500)).toBe('500 m');
    expect(formatRadius(1000)).toBe('1 km');
    expect(formatRadius(5000)).toBe('5 km');
  });
});
