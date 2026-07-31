import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { AdminData, AdminNav } from "../AdminClient";

export default function AdminPaymentsPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-5 py-12 lg:px-8">
        <AdminNav />
        <h1 className="mt-8 text-3xl font-semibold">Pagos.</h1>
        <div className="mt-8"><AdminData endpoint="/api/admin/payments" csvPath="/api/admin/payments?format=csv" label="pagos" /></div>
      </main>
      <Footer />
    </>
  );
}
