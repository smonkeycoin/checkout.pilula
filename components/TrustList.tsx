import { CheckCircle2 } from "lucide-react";

const items = [
  "Pago procesado directamente por Stripe.",
  "PILULA no recibe ni almacena números completos de tarjeta.",
  "Autenticación bancaria 3D Secure cuando sea requerida.",
  "Confirmación del pago por correo electrónico.",
  "Datos personales utilizados exclusivamente para inscripción, pago y facturación."
];

export function TrustList() {
  return (
    <ul className="grid gap-3 text-sm text-pilula-ivory/75">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-pilula-gold" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
