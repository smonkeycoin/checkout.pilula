import Image from "next/image";

type BrandLogoProps = {
  className?: string;
};

export function BrandLogo({ className = "" }: BrandLogoProps) {
  return (
    <Image
      src="/brand/pilula-medplanner-white.png"
      alt="PILULA MedPlanner"
      width={605}
      height={200}
      className={`h-auto ${className}`}
    />
  );
}
