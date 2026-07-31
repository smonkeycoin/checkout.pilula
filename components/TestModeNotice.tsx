import { LEGAL_APPROVED } from "@/config/legal";

export function TestModeNotice() {
  if (LEGAL_APPROVED) return null;
  return (
    <div className="border-b border-pilula-gold/20 bg-pilula-charcoal px-5 py-2 text-center text-xs text-pilula-ivory/70">
      Entorno de prueba: el lanzamiento live permanece bloqueado hasta aprobación legal y configuración de llaves reales.
    </div>
  );
}
