import { QuoteForm } from '@/components/QuoteForm';
import { Stepper } from '@/components/Stepper';

export default function Home() {
  return (
    <>
      <Stepper current="quote" />
      <h1 className="text-2xl font-bold text-slate-900">Get your CareShield Max quote</h1>
      <p className="mt-2 mb-6 text-slate-700">
        Two quick questions and you&apos;ll see your premium. We&apos;ll hold the price for 15
        minutes while you finish.
      </p>
      <QuoteForm />
    </>
  );
}
