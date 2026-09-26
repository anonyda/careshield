import { QuoteStatus } from '@prisma/client';
import { InvalidStateTransitionError } from '../src/common/errors/domain-errors';
import { assertTransition, canTransition, NEXT_STATUS } from '../src/insurance/quote-state-machine';

type Pair = [QuoteStatus, QuoteStatus];

const ALL = Object.values(QuoteStatus);
const VALID: Pair[] = [
  [QuoteStatus.QUOTE_GENERATED, QuoteStatus.MEDICAL_DECLARED],
  [QuoteStatus.MEDICAL_DECLARED, QuoteStatus.PREMIUM_PAID],
  [QuoteStatus.PREMIUM_PAID, QuoteStatus.POLICY_ISSUED],
];
const isValid = (from: QuoteStatus, to: QuoteStatus) =>
  VALID.some(([f, t]) => f === from && t === to);
const INVALID: Pair[] = ALL.flatMap((from) =>
  ALL.filter((to) => !isValid(from, to)).map((to): Pair => [from, to]),
);

describe('quote state machine', () => {
  it('has exactly the four states, in order', () => {
    expect(ALL).toEqual(['QUOTE_GENERATED', 'MEDICAL_DECLARED', 'PREMIUM_PAID', 'POLICY_ISSUED']);
  });

  it('treats POLICY_ISSUED as terminal', () => {
    expect(NEXT_STATUS.POLICY_ISSUED).toBeNull();
  });

  it.each(VALID)('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  it('checks every other pair (including self-transitions and skips)', () => {
    expect(INVALID).toHaveLength(ALL.length * ALL.length - VALID.length);
  });

  it.each(INVALID)('rejects %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => assertTransition(from, to)).toThrow(InvalidStateTransitionError);
  });
});
