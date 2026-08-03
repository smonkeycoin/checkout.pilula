import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { parseDashboardRange } from "@/lib/admin/dashboard";
import { AdminShell, DashboardAdmin } from "./AdminClient";

type Props = {
  searchParams?: Promise<{ range?: string }>;
};

export default async function AdminPage({ searchParams }: Props) {
  const params = await searchParams;
  const range = parseDashboardRange(params?.range);

  return (
    <>
      <Header />
      <AdminShell>
        <DashboardAdmin initialRange={range} />
      </AdminShell>
      <Footer />
    </>
  );
}
