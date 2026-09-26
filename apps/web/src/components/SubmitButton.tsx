interface SubmitButtonProps {
  pending: boolean;
  pendingLabel: string;
  disabled?: boolean;
  children: React.ReactNode;
}

export function SubmitButton({
  pending,
  pendingLabel,
  disabled = false,
  children,
}: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-700 px-4 py-3 text-base font-semibold text-white hover:bg-indigo-800 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400"
    >
      {pending && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
        />
      )}
      {pending ? pendingLabel : children}
    </button>
  );
}
