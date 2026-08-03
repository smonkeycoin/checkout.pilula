import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { AdminShell, PricingConfigAdmin } from "../../AdminClient";

export default function AdminPricingConfigPage() {
  return (
    <>
      <Header />
      <AdminShell title="Configuración de precios." subtitle="Registra el tipo de cambio comercial USD_MXN_RATE para nuevas invitaciones MXN.">
        <PricingConfigAdmin />
      </AdminShell>
      <Footer />
    </>
  );
}
