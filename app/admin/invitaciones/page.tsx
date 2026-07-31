import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { AdminNav, InvitationsAdmin } from "../AdminClient";

export default function AdminInvitesPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-5 py-12 lg:px-8">
        <AdminNav />
        <h1 className="mt-8 text-3xl font-semibold">Invitaciones.</h1>
        <div className="mt-8"><InvitationsAdmin /></div>
      </main>
      <Footer />
    </>
  );
}
