import request from 'supertest';
import {
  createQuote,
  createTestApp,
  expireQuote,
  resetDatabase,
  TestContext,
  validDeclaration,
} from './setup/test-app';

describe('Declaration API (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(() => resetDatabase(ctx.prisma));
  afterAll(() => ctx.app.close());

  const declare = (body: object) =>
    request(ctx.app.getHttpServer()).post('/api/v1/insurance/declaration').send(body);
  const statusOf = async (quoteId: string) =>
    (await ctx.prisma.quote.findUniqueOrThrow({ where: { id: quoteId } })).status;

  it('accepts a clean declaration and moves the quote to MEDICAL_DECLARED', async () => {
    const quoteId = await createQuote(ctx);
    const res = await declare({ quoteId, ...validDeclaration, isSmoker: true }).expect(200);

    expect(res.body).toEqual({
      quoteId,
      eligible: true,
      status: 'MEDICAL_DECLARED',
      repriced: false,
      premium: {
        base: '10000.00',
        ageLoading: '0.00',
        conditionLoading: '0.00',
        total: '10000.00',
      },
      expiresAt: expect.any(String),
      serverTime: expect.any(String),
    });
    const quote = await ctx.prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(quote.status).toBe('MEDICAL_DECLARED');
    expect(quote.declaredAt).toBeInstanceOf(Date);
    expect(quote.medicalDeclaration).toMatchObject({ isSmoker: true, conditions: ['NONE'] });
  });

  it('accepts declared conditions when the quote was priced with them', async () => {
    const quoteId = await createQuote(ctx, { age: 50, hasPreExistingConditions: true });
    await declare({ quoteId, ...validDeclaration, conditions: ['DIABETES', 'ASTHMA'] }).expect(200);
    expect(await statusOf(quoteId)).toBe('MEDICAL_DECLARED');
  });

  it.each([
    ['NONE combined with another condition', { conditions: ['NONE', 'ASTHMA'] }],
    ['an empty condition list', { conditions: [] }],
    ['duplicate conditions', { conditions: ['ASTHMA', 'ASTHMA'] }],
    ['an unknown condition', { conditions: ['FLU'] }],
    ['a non-boolean flag', { isSmoker: 'no' }],
    ['details over 500 characters', { additionalDetails: 'x'.repeat(501) }],
    ['an unknown field', { bmi: 22 }],
  ])('rejects %s with 400', async (_label, override) => {
    const quoteId = await createQuote(ctx, { age: 30, hasPreExistingConditions: true });
    const res = await declare({ quoteId, ...validDeclaration, ...override }).expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(await statusOf(quoteId)).toBe('QUOTE_GENERATED');
  });

  it('rejects conditions that the quote was not priced for (422, state unchanged)', async () => {
    const quoteId = await createQuote(ctx, { age: 30, hasPreExistingConditions: false });
    const res = await declare({ quoteId, ...validDeclaration, conditions: ['DIABETES'] }).expect(
      422,
    );

    expect(res.body.code).toBe('DECLARATION_INCONSISTENT');
    expect(res.body.message).toMatch(/recalculate your premium/i);
    expect(await statusOf(quoteId)).toBe('QUOTE_GENERATED');
  });

  it('reprices when the quote was priced with conditions but NONE is declared', async () => {
    const quoteId = await createQuote(ctx, { age: 50, hasPreExistingConditions: true });
    const before = await ctx.prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });

    const res = await declare({ quoteId, ...validDeclaration, conditions: ['NONE'] }).expect(200);

    expect(res.body).toMatchObject({
      status: 'MEDICAL_DECLARED',
      repriced: true,
      premium: {
        base: '10000.00',
        ageLoading: '5000.00',
        conditionLoading: '0.00',
        total: '15000.00',
      },
    });
    const quote = await ctx.prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(quote.hasPreExistingConditions).toBe(false);
    expect(quote.totalPremium.toFixed(2)).toBe('15000.00');
    expect(quote.expiresAt).toEqual(before.expiresAt); // the price lock is not extended
    expect(quote.medicalDeclaration).toMatchObject({ repricedFromTotal: '20000.00' });
  });

  it('does not reprice when the declaration matches the quote', async () => {
    const quoteId = await createQuote(ctx, { age: 50, hasPreExistingConditions: true });
    const res = await declare({ quoteId, ...validDeclaration, conditions: ['ASTHMA'] }).expect(200);
    expect(res.body).toMatchObject({ repriced: false, premium: { total: '20000.00' } });
  });

  it.each([
    ['a critical illness diagnosis', { hasCriticalIllnessDiagnosis: true }, /critical illness/],
    ['cancer', { conditions: ['CANCER'] }, /cancer/],
    ['heart disease', { conditions: ['HEART_DISEASE', 'DIABETES'] }, /heart disease/],
  ])('rejects %s as NOT_ELIGIBLE (422, state unchanged)', async (_label, override, reason) => {
    const quoteId = await createQuote(ctx, { age: 60, hasPreExistingConditions: true });
    const res = await declare({ quoteId, ...validDeclaration, ...override }).expect(422);

    expect(res.body.code).toBe('NOT_ELIGIBLE');
    expect(res.body.message).toMatch(reason);
    expect(await statusOf(quoteId)).toBe('QUOTE_GENERATED');
  });

  it('rejects a second declaration with 409 INVALID_STATE', async () => {
    const quoteId = await createQuote(ctx);
    await declare({ quoteId, ...validDeclaration }).expect(200);
    const res = await declare({ quoteId, ...validDeclaration }).expect(409);
    expect(res.body.code).toBe('INVALID_STATE');
  });

  it('only lets one of two concurrent declarations through', async () => {
    const quoteId = await createQuote(ctx);
    const results = await Promise.all([
      declare({ quoteId, ...validDeclaration }),
      declare({ quoteId, ...validDeclaration }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it('rejects an expired quote with 410 even if the UI is bypassed', async () => {
    const quoteId = await createQuote(ctx);
    await expireQuote(ctx, quoteId);
    const res = await declare({ quoteId, ...validDeclaration }).expect(410);
    expect(res.body.code).toBe('QUOTE_EXPIRED');
    expect(await statusOf(quoteId)).toBe('QUOTE_GENERATED');
  });

  it('404s for an unknown quote', async () => {
    const res = await declare({
      quoteId: '3f1c2b1e-0000-4000-8000-000000000000',
      ...validDeclaration,
    }).expect(404);
    expect(res.body.code).toBe('QUOTE_NOT_FOUND');
  });
});
