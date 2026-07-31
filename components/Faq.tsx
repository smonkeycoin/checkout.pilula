import { EVENT } from "@/config/checkout";
import { REFUND_POLICY_SUMMARY } from "@/config/legal";

const faqs = [
  ["¿En qué moneda se realiza el pago?", "El cargo se realiza en dólares estadounidenses."],
  ["¿Puedo solicitar factura?", "Sí. Después del pago podrás solicitar CFDI con los datos fiscales requeridos."],
  ["¿Cómo recibo la confirmación?", "Stripe confirma el pago y PILULA envía la confirmación por correo electrónico."],
  ["¿Puedo pagar como paciente sin valoración?", "No. El pago de paciente requiere valoración médica, indicación clínica y confirmación del equipo organizador."],
  ["¿Qué sucede si necesito cancelar?", REFUND_POLICY_SUMMARY],
  ["¿Con quién puedo comunicarme?", `${EVENT.supportEmail} · WhatsApp +52 55 3201 9586`]
];

export function Faq() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-14 lg:px-8" aria-labelledby="faq-title">
      <h2 id="faq-title" className="text-2xl font-semibold">Preguntas frecuentes</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {faqs.map(([question, answer]) => (
          <details key={question} className="border border-pilula-gold/20 bg-pilula-charcoal p-4">
            <summary className="cursor-pointer text-base font-medium text-pilula-ivory">{question}</summary>
            <p className="mt-3 text-sm leading-6 text-pilula-ivory/70">{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
