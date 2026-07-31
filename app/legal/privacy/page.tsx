import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { LEGAL_PROVIDER } from "@/config/legal";

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-5 py-14 leading-7 text-pilula-ivory/76 lg:px-8">
        <h1 className="text-3xl font-semibold text-pilula-ivory">Aviso de privacidad.</h1>
        <p className="mt-6">Responsable: {LEGAL_PROVIDER.legalName}, {LEGAL_PROVIDER.capitalRegime}.</p>
        <p className="mt-4">Nombre comercial: {LEGAL_PROVIDER.tradeName}.</p>
        <p className="mt-4">Domicilio: {LEGAL_PROVIDER.legalAddress}</p>
        <p className="mt-4">
          Los datos personales se usan para inscripción, pago, facturación, comunicación operativa y cumplimiento de obligaciones aplicables.
        </p>
        <p className="mt-4">
          PILULA no recibe ni almacena números completos de tarjeta. El procesamiento de pago se realiza mediante Stripe Checkout alojado por Stripe.
        </p>
        <p className="mt-4">
          No se almacena información médica en las tablas de pago, órdenes, eventos o solicitudes de factura.
        </p>
      </main>
      <Footer />
    </>
  );
}
