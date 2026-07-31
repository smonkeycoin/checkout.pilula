import { LockKeyhole } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { EVENT } from "@/config/checkout";

export function Header() {
  return (
    <header className="border-b border-pilula-gold/20">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <BrandMark />
        <div className="flex flex-wrap items-center gap-4 text-sm text-pilula-ivory/70">
          <span className="inline-flex min-h-11 items-center gap-2 border border-pilula-gold/25 px-3 text-pilula-ivory">
            <LockKeyhole aria-hidden="true" className="h-4 w-4 text-pilula-gold" />
            Conexión cifrada
          </span>
          <span>Pago procesado por Stripe</span>
          <a className="underline decoration-pilula-gold/50 underline-offset-4 hover:text-pilula-gold" href={EVENT.mainSiteUrl}>
            Volver a pilula.com.mx
          </a>
        </div>
      </div>
    </header>
  );
}
