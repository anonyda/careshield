import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { CheckoutService } from '../src/insurance/checkout.service';
import { hashRequest } from '../src/insurance/idempotency.service';
import {
  createDeclaredQuote,
  createQuote,
  createTestApp,
  expireQuote,
  resetDatabase,
  TestContext,
} from './setup/test-app';

describe('Checkout API (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    ctx.gateway.reset();
    jest.restoreAllMocks();
  });
  afterAll(() => ctx.app.close());

  const newKey = () => `key_${randomUUID()}`;
  const checkout = (key: string | null, quoteId: string, paymentToken = 'tok_success') => {
    const req = request(ctx.app.getHttpServer()).post('/api/v1/insurance/checkout');
    if (key) req.set('Idempotency-Key', key);
    return req.send({ quoteId, paymentToken });
  };
  const quoteStatus = async (quoteId: string) =>
    (await ctx.prisma.quote.findUniqueOrThrow({ where: { id: quoteId } })).status;
  const policyCount = (quoteId: string) => ctx.prisma.policy.count({ where: { quoteId } });
  const keyRow = (key: string) => ctx.prisma.idempotencyKey.findUnique({ where: { key } });

  it('1. happy path: issues exactly one policy and charges once', async () => {
    const quoteId = await createDeclaredQuote(ctx);
    const res = await checkout(newKey(), quoteId).expect(200);

    expect(res.headers['idempotent-replayed']).toBeUndefined();
    expect(res.body).toEqual({
      quoteId,
      status: 'POLICY_ISSUED',
      policy: {
        id: expect.any(String),
        policyNumber: expect.stringMatching(/^CSM-\d{4}-[0-9A-HJKMNP-TV-Z]{8}$/),
        premiumPaid: '10000.00',
        currency: 'INR',
        issuedAt: expect.any(String),
      },
      paymentReference: expect.stringMatching(/^pay_/),
    });
    expect(await quoteStatus(quoteId)).toBe('POLICY_ISSUED');
    expect(await policyCount(quoteId)).toBe(1);
    expect(ctx.gateway.chargeCount).toBe(1);

    const quote = await request(ctx.app.getHttpServer())
      .get(`/api/v1/insurance/quote/${quoteId}`)
      .expect(200);
    expect(quote.body.policy).toEqual({
      policyNumber: res.body.policy.policyNumber,
      issuedAt: res.body.policy.issuedAt,
      premiumPaid: '10000.00',
    });
  });

  it('2. ten parallel requests with the same key: one charge, one policy, same answer', async () => {
    const quoteId = await createDeclaredQuote(ctx);
    const key = newKey();

    const responses = await Promise.all(Array.from({ length: 10 }, () => checkout(key, quoteId)));

    const executed = responses.filter(
      (r) => r.status === 200 && r.headers['idempotent-replayed'] === undefined,
    );
    expect(executed).toHaveLength(1);
    for (const r of responses) {
      if (r.status === 200) {
        expect(r.body).toEqual(executed[0].body);
      } else {
        expect(r.status).toBe(409);
        expect(r.body.code).toBe('REQUEST_IN_PROGRESS');
        expect(r.headers['retry-after']).toBe('1');
      }
    }
    expect(await policyCount(quoteId)).toBe(1);
    expect(ctx.gateway.chargeCount).toBe(1);

    const replay = await checkout(key, quoteId).expect(200);
    expect(replay.headers['idempotent-replayed']).toBe('true');
    expect(replay.body).toEqual(executed[0].body);
    expect(ctx.gateway.chargeCount).toBe(1);
  });

  it('3. two different keys racing on one quote: one policy, loser gets 409 and any charge is refunded', async () => {
    const quoteId = await createDeclaredQuote(ctx);

    const responses = await Promise.all([checkout(newKey(), quoteId), checkout(newKey(), quoteId)]);

    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(responses.find((r) => r.status === 409)?.body.code).toBe('INVALID_STATE');
    expect(await policyCount(quoteId)).toBe(1);
    // Every charge except the winning one was refunded.
    expect(ctx.gateway.chargeCount - ctx.gateway.refunds.length).toBe(1);
  });

  it('4. reusing a key with a different body is rejected with 422', async () => {
    const first = await createDeclaredQuote(ctx);
    const second = await createDeclaredQuote(ctx);
    const key = newKey();

    await checkout(key, first).expect(200);
    const res = await checkout(key, second).expect(422);
    expect(res.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(await quoteStatus(second)).toBe('MEDICAL_DECLARED');
  });

  it('5. a failure inside the transaction rolls everything back and refunds', async () => {
    const quoteId = await createDeclaredQuote(ctx);
    const key = newKey();
    const service = ctx.app.get(CheckoutService);
    jest.spyOn(service, 'insertPolicy').mockImplementationOnce(async (tx, data) => {
      await tx.policy.create({ data }); // the insert really happens, then the transaction fails
      throw new Error('simulated failure after policy insert');
    });

    const res = await checkout(key, quoteId).expect(500);
    expect(res.body).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: expect.any(String),
      details: null,
    });
    expect(await quoteStatus(quoteId)).toBe('MEDICAL_DECLARED');
    expect(await policyCount(quoteId)).toBe(0);
    expect(ctx.gateway.refunds).toHaveLength(1);
    expect(await keyRow(key)).toBeNull();

    // The key was released, so retrying the same request succeeds with a fresh charge.
    await checkout(key, quoteId).expect(200);
    expect(await policyCount(quoteId)).toBe(1);
    expect(ctx.gateway.chargeCount).toBe(2);
    expect(ctx.gateway.refunds).toHaveLength(1);
  });

  describe('6. expiry', () => {
    it('rejects an expired quote with 410 without charging', async () => {
      const quoteId = await createDeclaredQuote(ctx);
      await expireQuote(ctx, quoteId);
      const key = newKey();

      const res = await checkout(key, quoteId).expect(410);
      expect(res.body.code).toBe('QUOTE_EXPIRED');
      expect(ctx.gateway.chargeCount).toBe(0);

      const replay = await checkout(key, quoteId).expect(410);
      expect(replay.headers['idempotent-replayed']).toBe('true');
    });

    it('refunds and returns 410 when the quote expires while the payment is processing', async () => {
      const quoteId = await createDeclaredQuote(ctx);
      const charge = ctx.gateway.charge.bind(ctx.gateway);
      jest.spyOn(ctx.gateway, 'charge').mockImplementationOnce(async (input) => {
        const result = await charge(input);
        await expireQuote(ctx, quoteId);
        return result;
      });

      const res = await checkout(newKey(), quoteId).expect(410);
      expect(res.body.code).toBe('QUOTE_EXPIRED');
      expect(ctx.gateway.chargeCount).toBe(1);
      expect(ctx.gateway.refunds).toHaveLength(1);
      expect(await policyCount(quoteId)).toBe(0);
      expect(await quoteStatus(quoteId)).toBe('MEDICAL_DECLARED');
    });
  });

  it('7. a declined card returns 402, is replayed, and leaves the quote payable', async () => {
    const quoteId = await createDeclaredQuote(ctx);
    const key = newKey();

    const res = await checkout(key, quoteId, 'tok_declined').expect(402);
    expect(res.body.code).toBe('PAYMENT_FAILED');

    const replay = await checkout(key, quoteId, 'tok_declined').expect(402);
    expect(replay.headers['idempotent-replayed']).toBe('true');
    expect(replay.body).toEqual(res.body);
    expect(await quoteStatus(quoteId)).toBe('MEDICAL_DECLARED');

    // A new attempt (new key) with a working card goes through.
    await checkout(newKey(), quoteId).expect(200);
  });

  describe('8. Idempotency-Key header', () => {
    it('is required', async () => {
      const quoteId = await createDeclaredQuote(ctx);
      const res = await checkout(null, quoteId).expect(400);
      expect(res.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
      expect(ctx.gateway.chargeCount).toBe(0);
    });

    it.each(['short', 'has spaces in it', 'x'.repeat(129), 'bad!chars#here'])(
      'rejects malformed key %p',
      async (key) => {
        const quoteId = await createDeclaredQuote(ctx);
        const res = await checkout(key, quoteId).expect(400);
        expect(res.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
      },
    );

    it('accepts the idempotency_key alias', async () => {
      const quoteId = await createDeclaredQuote(ctx);
      await request(ctx.app.getHttpServer())
        .post('/api/v1/insurance/checkout')
        .set('idempotency_key', newKey())
        .send({ quoteId, paymentToken: 'tok_success' })
        .expect(200);
    });
  });

  it('releases the key when the gateway is down so the same key can retry', async () => {
    const quoteId = await createDeclaredQuote(ctx);
    const key = newKey();

    const res = await checkout(key, quoteId, 'tok_error').expect(502);
    expect(res.body.code).toBe('PAYMENT_GATEWAY_ERROR');
    expect(await keyRow(key)).toBeNull();

    await checkout(key, quoteId, 'tok_error').expect(502);
    expect(await quoteStatus(quoteId)).toBe('MEDICAL_DECLARED');
    expect(ctx.gateway.chargeCount).toBe(0);
  });

  it('takes over a stale in-progress lock left by a crashed request', async () => {
    const quoteId = await createDeclaredQuote(ctx);
    const key = newKey();
    const stale = new Date(Date.now() - 5 * 60_000);
    await ctx.prisma.idempotencyKey.create({
      data: {
        key,
        requestHash: hashRequest({ quoteId, paymentToken: 'tok_success' }),
        lockedAt: stale,
        createdAt: stale,
      },
    });

    await checkout(key, quoteId).expect(200);
    expect(await policyCount(quoteId)).toBe(1);
  });

  it('reports a fresh in-progress lock as 409 REQUEST_IN_PROGRESS', async () => {
    const quoteId = await createDeclaredQuote(ctx);
    const key = newKey();
    await ctx.prisma.idempotencyKey.create({
      data: { key, requestHash: hashRequest({ quoteId, paymentToken: 'tok_success' }) },
    });

    const res = await checkout(key, quoteId).expect(409);
    expect(res.body.code).toBe('REQUEST_IN_PROGRESS');
  });

  it('refuses to pay before the medical declaration', async () => {
    const quoteId = await createQuote(ctx);
    const res = await checkout(newKey(), quoteId).expect(409);
    expect(res.body.code).toBe('INVALID_STATE');
    expect(ctx.gateway.chargeCount).toBe(0);
  });

  it('refuses to pay twice for an issued policy (new key)', async () => {
    const quoteId = await createDeclaredQuote(ctx);
    await checkout(newKey(), quoteId).expect(200);
    const res = await checkout(newKey(), quoteId).expect(409);
    expect(res.body.code).toBe('INVALID_STATE');
    expect(ctx.gateway.chargeCount).toBe(1);
  });

  it('404s for an unknown quote', async () => {
    const res = await checkout(newKey(), randomUUID()).expect(404);
    expect(res.body.code).toBe('QUOTE_NOT_FOUND');
  });
});
