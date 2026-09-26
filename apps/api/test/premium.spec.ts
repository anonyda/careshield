import { calculatePremium, formatMoney } from '../src/insurance/premium.calculator';

describe('calculatePremium', () => {
  it.each`
    age   | hasPreExistingConditions | ageLoading   | conditionLoading | total
    ${18} | ${false}                 | ${'0.00'}    | ${'0.00'}        | ${'10000.00'}
    ${30} | ${false}                 | ${'0.00'}    | ${'0.00'}        | ${'10000.00'}
    ${45} | ${false}                 | ${'0.00'}    | ${'0.00'}        | ${'10000.00'}
    ${46} | ${false}                 | ${'5000.00'} | ${'0.00'}        | ${'15000.00'}
    ${99} | ${false}                 | ${'5000.00'} | ${'0.00'}        | ${'15000.00'}
    ${18} | ${true}                  | ${'0.00'}    | ${'5000.00'}     | ${'15000.00'}
    ${45} | ${true}                  | ${'0.00'}    | ${'5000.00'}     | ${'15000.00'}
    ${46} | ${true}                  | ${'5000.00'} | ${'5000.00'}     | ${'20000.00'}
    ${52} | ${true}                  | ${'5000.00'} | ${'5000.00'}     | ${'20000.00'}
    ${99} | ${true}                  | ${'5000.00'} | ${'5000.00'}     | ${'20000.00'}
  `(
    'age $age, conditions $hasPreExistingConditions -> $total',
    ({ age, hasPreExistingConditions, ageLoading, conditionLoading, total }) => {
      const premium = calculatePremium({ age, hasPreExistingConditions });

      expect(formatMoney(premium.basePremium)).toBe('10000.00');
      expect(formatMoney(premium.ageLoading)).toBe(ageLoading);
      expect(formatMoney(premium.conditionLoading)).toBe(conditionLoading);
      expect(formatMoney(premium.totalPremium)).toBe(total);
      expect(premium.currency).toBe('INR');
    },
  );

  it('is deterministic for the same input', () => {
    const a = calculatePremium({ age: 60, hasPreExistingConditions: true });
    const b = calculatePremium({ age: 60, hasPreExistingConditions: true });
    expect(formatMoney(a.totalPremium)).toBe(formatMoney(b.totalPremium));
  });

  it('keeps total equal to the sum of its parts', () => {
    const p = calculatePremium({ age: 70, hasPreExistingConditions: true });
    expect(p.totalPremium.equals(p.basePremium.plus(p.ageLoading).plus(p.conditionLoading))).toBe(
      true,
    );
  });

  it.each([17, 100, 45.5, NaN])('rejects invalid age %p', (age) => {
    expect(() => calculatePremium({ age, hasPreExistingConditions: false })).toThrow(RangeError);
  });
});
