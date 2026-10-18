import type { Metadata } from "next";
import { AppLayout } from "@/components/layout/AppLayout";
import { DemoBanner } from "@/components/demo/DemoBanner";

export const metadata: Metadata = {
  title: { default: "Live demo", template: "%s · Demo · SpendSync" },
  description: "A read-only tour of SpendSync with sample data. No sign-up needed.",
  robots: { index: false, follow: true },
};

/**
 * Public, read-only demo. Excluded from Clerk protection in src/proxy.ts and
 * rendered entirely from src/lib/demo-data.ts: these routes never query the
 * database or call a server action.
 */
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout basePath="/demo" demo>
      <DemoBanner />
      {children}
    </AppLayout>
  );
}
