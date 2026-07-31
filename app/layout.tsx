import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Checkout PILULA MedPlanner",
  description: "Pago de participación para Hair Transplant Workshop by GeVa.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false
    }
  },
  openGraph: {
    title: "Checkout PILULA MedPlanner",
    description: "Pago de participación para Hair Transplant Workshop by GeVa.",
    type: "website"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
