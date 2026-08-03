import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { AdminData, AdminShell } from "../AdminClient";

export default function AdminPaymentsPage() {
  return (
    <>
      <Header />
      <AdminShell title="Pagos.">
        <AdminData endpoint="/api/admin/payments" csvPath="/api/admin/payments?format=csv" label="pagos" />
      </AdminShell>
      <Footer />
    </>
  );
}
