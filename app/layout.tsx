import type { Metadata } from "next";
import { Cormorant_Garamond, Lora } from "next/font/google";
import "./globals.css";
import I18nProvider from "./components/I18nProvider";
import LanguageWrapper from "./components/LanguageWrapper";
import ThemeProvider from "./components/ThemeProvider";
import { UI_THEME_STORAGE_KEY } from "./lib/theme";
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
  title: "dev-workspace",
  description: "Workspace de projetos, prompts e checkpoints",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${cormorant.variable} ${lora.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("${UI_THEME_STORAGE_KEY}");if(t==="dark")document.documentElement.setAttribute("data-theme","dark");}catch(e){}})();`,
          }}
        />
      </head>
      <body className={lora.className}>
        <ThemeProvider>
          <I18nProvider>
            <LanguageWrapper>{children}</LanguageWrapper>
          </I18nProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
