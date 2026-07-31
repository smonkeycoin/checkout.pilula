import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { AdminNav, InvoicesAdmin } from "../AdminClient";

export default function AdminInvoicesPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-5 py-12 lg:px-8">
        <AdminNav />
        <h1 className="mt-8 text-3xl font-semibold">Facturas.</h1>
        <p className="mt-3 text-pilula-ivory/70">Estados: solicitada, en revisión, requiere corrección, emitida o enviada.</p>
        <div className="mt-8"><InvoicesAdmin /></div>
      </main>
      <Footer />
    </>
  );
}
