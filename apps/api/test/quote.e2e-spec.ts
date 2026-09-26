import request from 'supertest';
import { createTestApp, resetDatabase, TestContext } from './setup/test-app';

describe('Quote API (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(() => resetDatabase(ctx.prisma));
  afterAll(() => ctx.app.close());

  const postQuote = (body: unknown) =>
    request(ctx.app.getHttpServer())
      .post('/api/v1/insurance/quote')
      .send(body as object);

  describe('POST /insurance/quote', () => {
    it.each`
      age   | conditions | total
      ${30} | ${false}   | ${'10000.00'}
      ${45} | ${false}   | ${'10000.00'}
      ${46} | ${false}   | ${'15000.00'}
      ${30} | ${true}    | ${'15000.00'}
      ${46} | ${true}    | ${'20000.00'}
    `('age $age / conditions $conditions -> $total', async ({ age, conditions, total }) => {
      const res = await postQuote({ age, hasPreExistingConditions: conditions }).expect(201);
      expect(res.body.premium.total).toBe(total);
    });

    it('returns the full contract with money as strings', async () => {
      const res = await postQuote({ age: 52, hasPreExistingConditions: true }).expect(201);

      expect(res.body).toEqual({
        quoteId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        status: 'QUOTE_GENERATED',
        currency: 'INR',
        premium: {
          base: '10000.00',
          ageLoading: '5000.00',
          conditionLoading: '5000.00',
          total: '20000.00',
        },
        createdAt: expect.any(String),
        expiresAt: expect.any(String),
        serverTime: expect.any(String),
      });
    });

    it('locks the quote for exactly 900 000 ms and stores timestamptz values', async () => {
      const res = await postQuote({ age: 30, hasPreExistingConditions: false }).expect(201);
      expect(Date.parse(res.body.expiresAt) - Date.parse(res.body.createdAt)).toBe(900_000);

      const [row] = await ctx.prisma.$queryRaw<
        Array<{ ms: number; created: string; money: string }>
      >`
        SELECT (EXTRACT(EPOCH FROM (expires_at - created_at)) * 1000)::int AS ms,
               pg_typeof(created_at)::text AS created,
               pg_typeof(total_premium)::text AS money
        FROM quotes WHERE id = ${res.body.quoteId}::uuid`;
      expect(row).toEqual({ ms: 900_000, created: 'timestamp with time zone', money: 'numeric' });
    });

    it.each([
      ['age as a string', { age: '52', hasPreExistingConditions: true }, 'age'],
      ['fractional age', { age: 30.5, hasPreExistingConditions: true }, 'age'],
      ['age below 18', { age: 17, hasPreExistingConditions: true }, 'age'],
      ['age above 99', { age: 100, hasPreExistingConditions: true }, 'age'],
      ['missing age', { hasPreExistingConditions: true }, 'age'],
      [
        'flag as a string',
        { age: 30, hasPreExistingConditions: 'true' },
        'hasPreExistingConditions',
      ],
      ['missing flag', { age: 30 }, 'hasPreExistingConditions'],
      ['unknown field', { age: 30, hasPreExistingConditions: false, discount: 50 }, 'discount'],
    ])('rejects %s with 400', async (_label, body, field) => {
      const res = await postQuote(body).expect(400);
      expect(res.body).toMatchObject({ statusCode: 400, code: 'VALIDATION_FAILED' });
      expect(res.body.details).toHaveProperty([field]);
    });

    it('rejects malformed JSON with the error envelope', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/v1/insurance/quote')
        .set('Content-Type', 'application/json')
        .send('{"age": 30,')
        .expect(400);
      expect(res.body).toMatchObject({ statusCode: 400, code: 'BAD_REQUEST', details: null });
      expect(res.body).not.toHaveProperty('stack');
    });
  });

  describe('GET /insurance/quote/:id', () => {
    it('returns the stored quote with a fresh serverTime', async () => {
      const created = await postQuote({ age: 60, hasPreExistingConditions: false }).expect(201);
      const res = await request(ctx.app.getHttpServer())
        .get(`/api/v1/insurance/quote/${created.body.quoteId}`)
        .expect(200);

      expect(res.body).toMatchObject({
        quoteId: created.body.quoteId,
        status: 'QUOTE_GENERATED',
        age: 60,
        hasPreExistingConditions: false,
        premium: { total: '15000.00' },
        expiresAt: created.body.expiresAt,
        policy: null,
      });
      expect(typeof res.body.serverTime).toBe('string');
    });

    it('still returns expired quotes', async () => {
      const created = await postQuote({ age: 30, hasPreExistingConditions: false }).expect(201);
      await ctx.prisma.quote.update({
        where: { id: created.body.quoteId },
        data: {
          createdAt: new Date(Date.now() - 20 * 60_000),
          expiresAt: new Date(Date.now() - 1000),
        },
      });
      await request(ctx.app.getHttpServer())
        .get(`/api/v1/insurance/quote/${created.body.quoteId}`)
        .expect(200);
    });

    it('404s for an unknown id', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/api/v1/insurance/quote/3f1c2b1e-0000-4000-8000-000000000000')
        .expect(404);
      expect(res.body.code).toBe('QUOTE_NOT_FOUND');
    });

    it('400s for a non-UUID id', async () => {
      await request(ctx.app.getHttpServer()).get('/api/v1/insurance/quote/not-a-uuid').expect(400);
    });
  });

  it('GET /health reports ok', async () => {
    await request(ctx.app.getHttpServer()).get('/api/v1/health').expect(200, { status: 'ok' });
  });
});
