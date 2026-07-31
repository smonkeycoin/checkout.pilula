import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { AdminLogin } from "../AdminClient";

export default function AdminLoginPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-4xl px-5 py-12 lg:px-8">
        <h1 className="text-3xl font-semibold">Acceso administrativo.</h1>
        <p className="mt-3 text-pilula-ivory/70">Magic link con Supabase Auth. Solo el correo autorizado puede usar APIs del panel.</p>
        <AdminLogin />
      </main>
      <Footer />
    </>
  );
}
