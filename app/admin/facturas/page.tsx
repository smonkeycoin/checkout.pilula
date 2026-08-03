import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { AdminShell, InvoicesAdmin } from "../AdminClient";

export default function AdminInvoicesPage() {
  return (
    <>
      <Header />
      <AdminShell title="Facturas." subtitle="Estados: solicitada, en revisión, requiere corrección, emitida o enviada.">
        <InvoicesAdmin />
      </AdminShell>
      <Footer />
    </>
  );
}
