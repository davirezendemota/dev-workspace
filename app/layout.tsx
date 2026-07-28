import type { Metadata } from "next";
import { Cormorant_Garamond, Lora } from "next/font/google";
import "./globals.css";
import I18nProvider from "./components/I18nProvider";
import LanguageWrapper from "./components/LanguageWrapper";
import ThemeProvider from "./components/ThemeProvider";
import { UI_MODE_STORAGE_KEY, UI_THEME_STORAGE_KEY } from "./lib/theme";
import { Toaster } from "sonner";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-classic-heading",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-classic-body",
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
    <html
      lang="pt-BR"
      className={`${cormorant.variable} ${lora.variable}`}
      data-ui-theme="classic"
      data-color-mode="light"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("${UI_THEME_STORAGE_KEY}"),m=localStorage.getItem("${UI_MODE_STORAGE_KEY}");if(t==="light"||t==="dark"){m=t;t="classic"}if(t!=="classic"&&t!=="github")t="classic";if(m!=="light"&&m!=="dark")m="light";document.documentElement.setAttribute("data-ui-theme",t);document.documentElement.setAttribute("data-color-mode",m)}catch(e){}})();`,
          }}
        />
      </head>
      <body>
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
