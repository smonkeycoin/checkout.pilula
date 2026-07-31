import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { InvoiceForm } from "./InvoiceForm";

type Props = {
  searchParams: Promise<{ order?: string; token?: string }>;
};

export default async function InvoicePage({ searchParams }: Props) {
  const { order, token } = await searchParams;
  const hasSignedLink = Boolean(order && token);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-5 py-14 lg:px-8">
        <h1 className="text-3xl font-semibold">Solicitud de CFDI.</h1>
        <p className="mt-4 leading-7 text-pilula-ivory/72">
          Solicita la factura posterior al pago. No es necesario subir Constancia de Situación Fiscal como requisito obligatorio.
        </p>
        <p className="mt-3 leading-7 text-pilula-ivory/72">
          La emisión del CFDI será procesada por el equipo administrativo de PILULA.
        </p>
        {hasSignedLink ? (
          <InvoiceForm orderId={order as string} token={token as string} />
        ) : (
          <p className="mt-8 border border-pilula-gold/30 p-4 text-sm text-pilula-ivory/76">
            Para proteger tus datos fiscales, abre esta página desde el enlace firmado incluido en la confirmación de pago.
          </p>
        )}
      </main>
      <Footer />
    </>
  );
}
