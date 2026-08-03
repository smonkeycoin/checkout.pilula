import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ADMIN_ACCESS_DENIED_MESSAGE } from "@/lib/admin-auth";
import { AdminLogin } from "../AdminClient";

type AdminLoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const params = await searchParams;
  const errorMessage =
    params?.error === "unauthorized"
      ? ADMIN_ACCESS_DENIED_MESSAGE
      : params?.error === "session_expired"
        ? "Tu sesión expiró. Inicia sesión nuevamente."
        : undefined;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-4xl px-5 py-12 lg:px-8">
        <h1 className="text-3xl font-semibold">Acceso administrativo.</h1>
        <p className="mt-3 text-pilula-ivory/70">Google OAuth con Supabase Auth. Solo los correos autorizados pueden usar APIs del panel.</p>
        <AdminLogin errorMessage={errorMessage} />
      </main>
      <Footer />
    </>
  );
}
