import { CalendarDays, MapPin } from "lucide-react";
import { Faq } from "@/components/Faq";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { TestModeNotice } from "@/components/TestModeNotice";
import { TrustList } from "@/components/TrustList";
import { EVENT, formatUsd, PLANS } from "@/config/checkout";

export default function HomePage() {
  return (
    <>
      <TestModeNotice />
      <Header />
      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-18">
          <div className="space-y-8">
            <div className="space-y-5">
              <p className="text-sm font-semibold tracking-[0.24em] text-pilula-gold">
                7ª EDICIÓN · {EVENT.dateShort}
              </p>
              <h1 className="max-w-3xl text-5xl font-semibold leading-[1.05] text-pilula-ivory sm:text-6xl">
                Confirma tu participación.
              </h1>
              <p className="max-w-2xl text-xl leading-8 text-pilula-ivory/82">
                {EVENT.program} · {EVENT.location}.
              </p>
              <p className="max-w-2xl leading-7 text-pilula-ivory/68">
                Selecciona tu modalidad. El pago se realiza en USD y es procesado directamente por Stripe.
              </p>
            </div>

            <div className="grid gap-4 border-y border-pilula-gold/20 py-6 sm:grid-cols-2">
              <div className="flex gap-3">
                <CalendarDays className="mt-1 h-5 w-5 text-pilula-gold" aria-hidden="true" />
                <div>
                  <p className="font-medium">Fecha</p>
                  <p className="text-sm text-pilula-ivory/65">{EVENT.dateLabel}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <MapPin className="mt-1 h-5 w-5 text-pilula-gold" aria-hidden="true" />
                <div>
                  <p className="font-medium">Ubicación</p>
                  <p className="text-sm text-pilula-ivory/65">{EVENT.location}</p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold">Resumen del programa</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {EVENT.format.map((item) => (
                  <li key={item} className="border border-pilula-gold/20 px-4 py-3 text-sm text-pilula-ivory/72">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <TrustList />

            <p className="border border-pilula-gold/25 bg-pilula-charcoal px-4 py-3 text-sm leading-6 text-pilula-ivory/76">
              El cargo se realiza en dólares estadounidenses. Tu banco puede aplicar conversión de moneda o cargos adicionales según las condiciones de tu tarjeta.
            </p>
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start" aria-label="Resumen de compra">
            <div className="mb-4 border border-pilula-gold/20 bg-pilula-black p-5">
              <p className="text-sm uppercase tracking-[0.18em] text-pilula-gold">Resumen</p>
              <div className="mt-4 space-y-2 text-sm text-pilula-ivory/72">
                <div className="flex justify-between gap-4">
                  <span>Médico participante</span>
                  <span>{formatUsd(PLANS.doctor.total)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Paciente aprobado</span>
                  <span>{formatUsd(PLANS.patient.total)}</span>
                </div>
              </div>
            </div>
            <section className="space-y-4" aria-label="Solicitudes">
              <PublicPlanCard
                title={PLANS.doctor.displayTitle}
                subtotal={PLANS.doctor.subtotal}
                total={PLANS.doctor.total}
                cta="Solicitar lugar como médico"
                href={`mailto:${EVENT.supportEmail}?subject=Solicitud%20de%20lugar%20médico%20HTW%202026`}
                note={PLANS.doctor.microcopy}
              />
              <PublicPlanCard
                title={PLANS.patient.displayTitle}
                subtotal={PLANS.patient.subtotal}
                total={PLANS.patient.total}
                cta="Solicitar valoración como paciente"
                href={`${EVENT.landingUrl}#valoracion`}
                note={PLANS.patient.requiredCopy}
              />
            </section>
          </aside>
        </section>
        <Faq />
      </main>
      <Footer />
    </>
  );
}

function PublicPlanCard({
  title,
  subtotal,
  total,
  cta,
  href,
  note
}: {
  title: string;
  subtotal: number;
  total: number;
  cta: string;
  href: string;
  note: string;
}) {
  return (
    <article className="border border-pilula-gold/30 bg-pilula-charcoal p-5 shadow-gold">
      <p className="text-sm uppercase tracking-[0.18em] text-pilula-gold">{title}</p>
      <p className="mt-4 text-3xl font-semibold">{formatUsd(subtotal)}</p>
      <p className="text-sm text-pilula-ivory/65">+ IVA · Total {formatUsd(total)}</p>
      <a
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center bg-pilula-burgundy px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#7A0A40]"
        href={href}
      >
        {cta}
      </a>
      <p className="mt-4 text-sm leading-6 text-pilula-ivory/68">{note}</p>
    </article>
  );
}
