"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shows a dismissible success/error banner based on URL search params.
 * Used after OAuth redirects to provide user feedback.
 */
export function OAuthStatusBanner() {
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success) {
      setStatus({
        type: "success",
        message: `${success.charAt(0).toUpperCase() + success.slice(1)} connected successfully! The first audit will run on the next scheduled cycle.`,
      });
      setVisible(true);
    } else if (error) {
      const errorMessages: Record<string, string> = {
        oauth_denied: "You denied access to the application. No integration was connected.",
        oauth_failed: "The OAuth handshake failed. Please try again.",
        token_exchange_failed: "Failed to exchange authorization code for tokens. Please try again.",
        config_missing: "Server configuration is incomplete. Please check environment variables.",
        unauthorized: "You don't have permission to connect integrations to this workspace.",
        invalid_callback: "Invalid callback parameters received. Please try connecting again.",
        oauth_init_failed: "Failed to start the OAuth flow. Please try again.",
      };
      setStatus({
        type: "error",
        message: errorMessages[error] || `An unexpected error occurred: ${error}`,
      });
      setVisible(true);
    }
  }, [searchParams]);

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => setVisible(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible || !status) return null;

  const isSuccess = status.type === "success";

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 shadow-sm animate-in slide-in-from-top-2 duration-300",
        isSuccess
          ? "border-emerald-200 bg-emerald-50/80 text-emerald-800"
          : "border-red-200 bg-red-50/80 text-red-800"
      )}
    >
      {isSuccess ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
      ) : (
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
      )}
      <p className="flex-1 text-[13px] font-medium leading-relaxed">
        {status.message}
      </p>
      <button
        onClick={() => setVisible(false)}
        className={cn(
          "shrink-0 rounded-md p-1 transition-colors",
          isSuccess
            ? "hover:bg-emerald-200/50 text-emerald-600"
            : "hover:bg-red-200/50 text-red-600"
        )}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
