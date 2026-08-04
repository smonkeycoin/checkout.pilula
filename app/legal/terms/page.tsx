import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { CANCELLATION_RULES, LEGAL_PROVIDER, TERMS_VERSION } from "@/config/legal";

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-5 py-14 leading-7 text-pilula-ivory/76 lg:px-8">
        <p className="text-sm font-semibold tracking-[0.2em] text-pilula-gold">VERSIÓN {TERMS_VERSION}</p>
        <h1 className="mt-4 text-3xl font-semibold text-pilula-ivory">Términos de inscripción.</h1>
        <p className="mt-6">Estos términos regulan la inscripción y pago del Hair Transplant Workshop by GeVa.</p>
        <h2 className="mt-8 text-xl font-semibold text-pilula-ivory">Inscripción</h2>
        <p>La participación queda sujeta a invitación aprobada, disponibilidad, confirmación del equipo organizador y validación del pago.</p>
        <h2 className="mt-8 text-xl font-semibold text-pilula-ivory">Cancelaciones</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          {CANCELLATION_RULES.map((rule) => <li key={rule}>{rule}</li>)}
        </ul>
        <h2 className="mt-8 text-xl font-semibold text-pilula-ivory">Facturación</h2>
        <p>La emisión de CFDI se procesa manualmente por el contador de PILULA a partir de la solicitud fiscal posterior al pago.</p>
        <h2 className="mt-8 text-xl font-semibold text-pilula-ivory">Datos legales</h2>
        <p>Razón social: {LEGAL_PROVIDER.legalName}.</p>
        <p>RFC: {LEGAL_PROVIDER.rfc}.</p>
        <p>Régimen de capital: {LEGAL_PROVIDER.capitalRegime}.</p>
        <p>Régimen fiscal: {LEGAL_PROVIDER.taxRegime}.</p>
        <p>Domicilio: {LEGAL_PROVIDER.legalAddress}</p>
      </main>
      <Footer />
    </>
  );
}
