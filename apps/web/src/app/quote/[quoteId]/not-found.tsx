import Link from 'next/link';

export default function QuoteNotFound() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-bold text-slate-900">We couldn&apos;t find that quote</h2>
      <p className="mt-2 text-slate-700">
        The link may be mistyped, or the quote may no longer exist.
      </p>
      <Link
        href="/"
        className="mt-4 inline-block rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800"
      >
        Get a new quote
      </Link>
    </section>
  );
}
