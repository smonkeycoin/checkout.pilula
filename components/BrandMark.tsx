import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export function BrandMark() {
  return (
    <Link href="/" className="inline-flex items-center" aria-label="Ir al checkout de PILULA">
      <BrandLogo className="w-[132px] sm:w-[176px]" />
    </Link>
  );
}
