import type { Metadata } from "next";
import { AppLayout } from "@/components/layout/AppLayout";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · SpendSync" },
  description: "A read-only tour of SpendSync. No sign-up needed.",
  robots: { index: false, follow: true },
};

/**
 * Public, read-only sample workspace. Excluded from Clerk protection in
 * src/proxy.ts and rendered entirely from src/lib/demo-data.ts: these routes
 * never query the database or call a server action. The only hint that it is
 * a sample is the "Sample workspace" pill in the sidebar.
 */
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout basePath="/demo" demo>
      {children}
    </AppLayout>
  );
}
