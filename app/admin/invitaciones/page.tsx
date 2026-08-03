import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { AdminShell, InvitationsAdmin } from "../AdminClient";

export default function AdminInvitesPage() {
  return (
    <>
      <Header />
      <AdminShell title="Invitaciones.">
        <InvitationsAdmin />
      </AdminShell>
      <Footer />
    </>
  );
}
