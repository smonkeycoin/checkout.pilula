import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { AdminNav } from "./AdminClient";

export default function AdminPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-5 py-12 lg:px-8">
        <h1 className="text-3xl font-semibold">Panel administrativo.</h1>
        <p className="mt-3 text-pilula-ivory/70">Gestiona invitaciones, pagos y facturación manual.</p>
        <div className="mt-8"><AdminNav /></div>
      </main>
      <Footer />
    </>
  );
}
