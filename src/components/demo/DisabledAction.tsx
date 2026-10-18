import React from "react";
import { Plus } from "lucide-react";

/**
 * Stand-in for a write action (Add, Delete) on the public sample workspace.
 * Looks like the real button but has no handler, so it is inert. Server component.
 */
export function DisabledAction({ label, variant = "primary" }: { label: string; variant?: "primary" | "danger" }) {
  return (
    <button
      type="button"
      aria-disabled
      title="Available in your own workspace"
      className={
        variant === "danger"
          ? "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-5 text-sm font-semibold text-red-600 shadow-sm"
          : "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-transparent bg-[#00ed64] px-5 text-sm font-semibold text-[#001e2b] shadow-sm"
      }
    >
      {variant === "primary" && <Plus className="h-4 w-4" />}
      {label}
    </button>
  );
}
