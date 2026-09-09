import { describe, expect, it } from 'vitest';
import { priceWithCoupon, couponExpiryLabel, COMMERCIAL_PERCENTS } from './coupon';
describe('coupon', () => {
  it('preço com desconto em centavos', () => { expect(priceWithCoupon(159.9, 20)).toBe(127.92); expect(priceWithCoupon(null, 20)).toBeNull(); });
  it('percentuais do comercial', () => { expect(COMMERCIAL_PERCENTS).toEqual([5, 10, 15, 20]); });
  it('label de validade dd/MM', () => { expect(couponExpiryLabel('2026-09-12T23:59:00-03:00')).toBe('12/09'); expect(couponExpiryLabel(null)).toBe('—'); });
});
