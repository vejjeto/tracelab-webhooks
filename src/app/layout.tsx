import { Providers } from "@/components/Providers";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TraceLab — Live Webhook Inspector & API Replay",
  description:
    "Inspector de webhooks en tiempo real con SSE, verificador HMAC-SHA256, snippets cURL/TS/Python y Replay API con diff visual.",
};

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");var d=t!=="light";document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export default function RootLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: Dark-mode-first FOUC prevention */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
