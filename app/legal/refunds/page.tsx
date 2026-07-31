import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { CANCELLATION_RULES } from "@/config/legal";

export default function RefundsPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-5 py-14 leading-7 text-pilula-ivory/76 lg:px-8">
        <h1 className="text-3xl font-semibold text-pilula-ivory">Política de cancelaciones y reembolsos.</h1>
        <p className="mt-6">Política vigente para cancelaciones, transferencias, cambios de edición y devoluciones.</p>
        <ul className="mt-6 list-disc space-y-3 pl-5">
          {CANCELLATION_RULES.map((rule) => <li key={rule}>{rule}</li>)}
        </ul>
      </main>
      <Footer />
    </>
  );
}
