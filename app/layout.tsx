import type { Metadata } from "next";
import { Cormorant_Garamond, Lora } from "next/font/google";
import "./globals.css";
import I18nProvider from "./components/I18nProvider";
import LanguageWrapper from "./components/LanguageWrapper";
import { Toaster } from "sonner";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-heading",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dev Workspace",
  description: "Workspace de projetos, agentes e checkpoints",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${cormorant.variable} ${lora.variable}`}>
      <body className={lora.className}>
        <I18nProvider>
          <LanguageWrapper>{children}</LanguageWrapper>
        </I18nProvider>
        <Toaster />
      </body>
    </html>
  );
}
