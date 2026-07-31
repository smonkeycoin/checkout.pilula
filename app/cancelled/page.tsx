import Link from "next/link";
import { XCircle } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { EVENT } from "@/config/checkout";

type Props = {
  searchParams: Promise<{ plan?: string }>;
};

export default async function CancelledPage({ searchParams }: Props) {
  const { plan } = await searchParams;
  const retryUrl = plan === "patient" ? EVENT.landingUrl : "/";

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-5 py-14 lg:px-8">
        <div className="border border-pilula-gold/30 bg-pilula-charcoal p-6 sm:p-8">
          <XCircle className="h-12 w-12 text-pilula-gold" aria-hidden="true" />
          <h1 className="mt-5 text-3xl font-semibold">Pago cancelado.</h1>
          <p className="mt-4 leading-7 text-pilula-ivory/72">
            No se realizó ningún cargo. Puedes intentarlo nuevamente o comunicarte con PILULA si necesitas apoyo.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link className="inline-flex min-h-11 items-center justify-center bg-pilula-burgundy px-5 text-sm font-semibold text-white" href={retryUrl}>
              Intentar nuevamente
            </Link>
            <a className="inline-flex min-h-11 items-center justify-center border border-pilula-gold/40 px-5 text-sm font-semibold" href={`mailto:${EVENT.supportEmail}`}>
              Contactar soporte
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
