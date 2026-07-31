import Link from "next/link";
import { EVENT } from "@/config/checkout";

export function Footer() {
  return (
    <footer className="border-t border-pilula-gold/20">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-pilula-ivory/65 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <p>{EVENT.brand} · {EVENT.supportEmail} · WhatsApp +52 55 3201 9586</p>
        <nav className="flex flex-wrap gap-4">
          <Link className="hover:text-pilula-gold" href="/legal/terms">Términos</Link>
          <Link className="hover:text-pilula-gold" href="/legal/privacy">Privacidad</Link>
          <Link className="hover:text-pilula-gold" href="/legal/refunds">Cancelaciones</Link>
        </nav>
      </div>
    </footer>
  );
}
