import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { AdminNav, PricingConfigAdmin } from "../../AdminClient";

export default function AdminPricingConfigPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-5 py-12 lg:px-8">
        <AdminNav />
        <h1 className="mt-8 text-3xl font-semibold">Configuración de precios.</h1>
        <p className="mt-3 text-pilula-ivory/70">Registra el tipo de cambio comercial USD_MXN_RATE para nuevas invitaciones MXN.</p>
        <div className="mt-8"><PricingConfigAdmin /></div>
      </main>
      <Footer />
    </>
  );
}
