import "./globals.css";
import { Suspense } from "react";
import { GlobalLoadingIndicator } from "@/components/client/GlobalLoadingIndicator";

export const metadata = { title: "Fivopay Intelligence & Sales CRM", description: "Manalix Technologies — internal" , robots: { index: false, follow: false } };
export const viewport = { width: "device-width", initialScale: 1 };
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={null}>
          <GlobalLoadingIndicator />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
