import Link from 'next/link';

/** Inline error for a single field. Link it to the input with aria-describedby. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-sm font-medium text-red-700">
      {message}
    </p>
  );
}

/** Form-level error banner. */
export function FormError({ message, children }: { message?: string; children?: React.ReactNode }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900"
    >
      <p className="font-medium">{message}</p>
      {children}
    </div>
  );
}

export function RecalculateLink() {
  return (
    <Link
      href="/"
      className="mt-3 inline-block rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
    >
      Recalculate premium
    </Link>
  );
}

export function ExpiredBanner() {
  return (
    <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-900">
      <p className="font-semibold">Your quote has expired</p>
      <p className="mt-1 text-sm">Quotes are held for 15 minutes. Get a fresh quote to continue.</p>
      <RecalculateLink />
    </div>
  );
}
