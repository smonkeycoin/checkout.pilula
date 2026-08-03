import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { parseDashboardRange } from "@/lib/admin/dashboard";
import { AdminNav, DashboardAdmin } from "./AdminClient";

type Props = {
  searchParams?: Promise<{ range?: string }>;
};

export default async function AdminPage({ searchParams }: Props) {
  const params = await searchParams;
  const range = parseDashboardRange(params?.range);

  return (
    <>
      <Header />
      <main className="mx-auto grid max-w-[1400px] gap-6 px-5 py-8 lg:grid-cols-[260px_1fr] lg:px-8">
        <aside>
          <AdminNav />
        </aside>
        <section>
          <DashboardAdmin initialRange={range} />
        </section>
      </main>
      <Footer />
    </>
  );
}
