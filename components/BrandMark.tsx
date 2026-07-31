import Link from "next/link";
import { EVENT } from "@/config/checkout";

export function BrandMark() {
  return (
    <Link href="/" className="inline-flex items-center gap-3" aria-label="Ir al checkout de PILULA">
      <span className="flex h-11 w-11 items-center justify-center border border-pilula-gold/70 text-sm font-semibold tracking-[0.12em] text-pilula-gold">
        PI
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold tracking-[0.16em] text-pilula-ivory">{EVENT.brand}</span>
        <span className="block text-xs text-pilula-ivory/62">Checkout oficial</span>
      </span>
    </Link>
  );
}
