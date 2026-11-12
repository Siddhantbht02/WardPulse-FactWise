import "./globals.css";
import type { Metadata, Viewport } from "next";
import { AppProvider } from "@/components/AppContext";
import { Navbar } from "@/components/Navbar";
import { MobileTabBar } from "@/components/MobileTabBar";
import { ToastContainer } from "@/components/ToastContainer";

export const metadata: Metadata = {
  title: "WardPulse — Virus Quarantine & Treatment Ward Board",
  description: "Live floor-plan ward board, pipeline-gated clinical rounds, and Wilson 95% CI quality analytics for quarantine facilities.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0284c7",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('wardpulse_theme');
                if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
                if (localStorage.getItem('wardpulse_contrast') === 'true') {
                  document.documentElement.classList.add('high-contrast');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="antialiased selection:bg-sky-500 selection:text-white pb-20 lg:pb-0 bg-background text-foreground transition-colors duration-200">
        <AppProvider>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6">{children}</main>
            <MobileTabBar />
            <ToastContainer />
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
