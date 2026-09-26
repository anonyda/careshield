import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/configure-app';
import { MockPaymentGateway } from '../../src/payments/mock-payment-gateway';
import { PrismaService } from '../../src/prisma/prisma.service';

export interface TestContext {
  app: INestApplication<App>;
  prisma: PrismaService;
  gateway: MockPaymentGateway;
}

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>({ logger: false });
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService), gateway: app.get(MockPaymentGateway) };
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE policies, quotes, idempotency_keys RESTART IDENTITY CASCADE',
  );
}

export const validDeclaration = {
  isSmoker: false,
  hospitalizedLast24Months: false,
  hasCriticalIllnessDiagnosis: false,
  conditions: ['NONE'],
  additionalDetails: '',
};

/** Creates a quote through the API and returns its id. */
export async function createQuote(
  { app }: TestContext,
  body = { age: 30, hasPreExistingConditions: false },
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/insurance/quote')
    .send(body)
    .expect(201);
  return (res.body as { quoteId: string }).quoteId;
}

/** Creates a quote and submits a valid declaration, leaving it MEDICAL_DECLARED. */
export async function createDeclaredQuote(ctx: TestContext): Promise<string> {
  const quoteId = await createQuote(ctx);
  await request(ctx.app.getHttpServer())
    .post('/api/v1/insurance/declaration')
    .send({ quoteId, ...validDeclaration })
    .expect(200);
  return quoteId;
}

export async function expireQuote({ prisma }: TestContext, quoteId: string): Promise<void> {
  await prisma.quote.update({
    where: { id: quoteId },
    data: { createdAt: new Date(Date.now() - 20 * 60_000), expiresAt: new Date(Date.now() - 1000) },
  });
}
