import React from "react";
import { Lock } from "lucide-react";

/** Stand-in for a write action (Add, Edit, Delete) on the public demo. Server component. */
export function DisabledAction({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      title="Disabled in demo mode. Create your own workspace to use this."
      className="inline-flex h-10 cursor-not-allowed items-center justify-center gap-2 rounded-full border border-dashed border-hairline-strong bg-surface-3 px-5 text-sm font-semibold text-ink-subtle"
    >
      <Lock className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
