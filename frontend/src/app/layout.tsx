import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NEXUS OS - Sistema Operativo",
  description: "Plataforma de gestión operativa y analytics",
};

import Sidebar from "@/components/Sidebar";
import LayoutWrapper from "@/components/LayoutWrapper";
import { AuthProvider } from "@/context/AuthContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import { SWRProvider } from "@/components/SWRProvider";
import { Toaster } from "@/components/ui/toaster";

import { ThemeProvider } from "@/components/ThemeProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-sans antialiased bg-background text-foreground transition-colors duration-300`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ErrorBoundary>
            <AuthProvider>
              <SWRProvider>
                <LayoutWrapper>
                  {children}
                  <Toaster />
                </LayoutWrapper>
              </SWRProvider>
            </AuthProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
