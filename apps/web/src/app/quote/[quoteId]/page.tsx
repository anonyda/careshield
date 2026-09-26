import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { DeclarationForm } from '@/components/DeclarationForm';
import { PaymentPanel } from '@/components/PaymentPanel';
import { PremiumBreakdown } from '@/components/PremiumBreakdown';
import { Stepper } from '@/components/Stepper';
import { getQuote } from '@/lib/api';
import { formatDateTime, formatINR } from '@/lib/format';
import type { Quote } from '@/lib/types';
import { QuoteSkeleton } from './QuoteSkeleton';

export default async function QuotePage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  // The heading streams immediately; the quote-dependent content streams in when ready.
  return (
    <>
      <h1 className="sr-only">Your CareShield Max application</h1>
      <Suspense fallback={<QuoteSkeleton />}>
        <QuoteStep quoteId={quoteId} />
      </Suspense>
    </>
  );
}

/** Renders the step that matches the stored status, so every step survives a refresh. */
async function QuoteStep({ quoteId }: { quoteId: string }) {
  const quote = await getQuote(quoteId);
  if (!quote) notFound();

  const expired = Date.parse(quote.expiresAt) <= Date.parse(quote.serverTime);
  const summary = (
    <PremiumBreakdown
      premium={quote.premium}
      age={quote.age}
      hasPreExistingConditions={quote.hasPreExistingConditions}
    />
  );

  switch (quote.status) {
    case 'QUOTE_GENERATED':
      return (
        <>
          <Stepper current="declaration" />
          <div className="space-y-6">
            {summary}
            <DeclarationForm
              quoteId={quote.quoteId}
              expiresAt={quote.expiresAt}
              serverTime={quote.serverTime}
              initiallyExpired={expired}
            />
          </div>
        </>
      );
    case 'MEDICAL_DECLARED':
      return (
        <PaymentPanel
          quoteId={quote.quoteId}
          total={quote.premium.total}
          expiresAt={quote.expiresAt}
          serverTime={quote.serverTime}
          initiallyExpired={expired}
          summary={summary}
        />
      );
    case 'POLICY_ISSUED':
      return <Confirmation quote={quote} />;
    case 'PREMIUM_PAID':
      // Only exists inside the checkout transaction; shown defensively.
      return (
        <>
          <Stepper current="payment" processing />
          <p role="status" className="text-slate-800">
            Finalising your policy…{' '}
            <Link
              href={`/quote/${quote.quoteId}`}
              className="font-semibold text-indigo-800 underline"
            >
              Refresh
            </Link>
          </p>
        </>
      );
  }
}

function Confirmation({ quote }: { quote: Quote }) {
  const policy = quote.policy;
  return (
    <>
      <Stepper current="policy" />
      <section
        aria-labelledby="confirmation-heading"
        className="rounded-lg border border-teal-300 bg-white p-6 shadow-sm"
      >
        <p className="text-sm font-semibold text-teal-800">Payment received</p>
        <h2 id="confirmation-heading" className="mt-1 text-2xl font-bold text-slate-900">
          You&apos;re covered
        </h2>
        {policy && (
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="text-sm text-slate-600">Policy number</dt>
              <dd className="font-mono text-xl font-semibold tracking-wide text-slate-900">
                {policy.policyNumber}
              </dd>
            </div>
            <div className="flex justify-between gap-4 text-sm">
              <dt className="text-slate-600">Premium paid</dt>
              <dd className="font-medium tabular-nums">{formatINR(policy.premiumPaid)}</dd>
            </div>
            <div className="flex justify-between gap-4 text-sm">
              <dt className="text-slate-600">Issued</dt>
              <dd className="font-medium">{formatDateTime(policy.issuedAt)} IST</dd>
            </div>
            <div className="flex justify-between gap-4 text-sm">
              <dt className="text-slate-600">Plan</dt>
              <dd className="font-medium">CareShield Max</dd>
            </div>
          </dl>
        )}
        <p className="mt-4 text-sm text-slate-700">
          Keep your policy number for claims and renewals.
        </p>
      </section>
      <Link href="/" className="mt-6 inline-block font-semibold text-indigo-800 underline">
        Start a new quote
      </Link>
    </>
  );
}
