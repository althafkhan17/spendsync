"use client";

import React, { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteAllSubscriptions } from "@/app/actions/workspace";

export function DangerZone() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDeleteAll() {
    setError(null);
    startTransition(async () => {
      const res = await deleteAllSubscriptions();
      if (res.success) {
        setOpen(false);
      } else {
        setError(res.error ?? "Failed to delete subscriptions");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="inline-flex shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-all outline-none select-none h-10 px-5 cursor-pointer font-semibold text-sm"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Delete all subscriptions
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px] bg-white border border-hairline text-ink rounded-lg shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-ink">
            Delete All Subscriptions
          </DialogTitle>
          <DialogDescription className="text-sm text-[#5c6c7a]">
            Are you absolutely sure? This will permanently delete all SaaS subscription records in this workspace. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            className="h-10 rounded-full border border-hairline-strong hover:bg-slate-100 text-ink font-semibold px-5"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={handleDeleteAll}
            className="h-10 rounded-full gap-2 border border-transparent cursor-pointer font-semibold px-5"
          >
            {isPending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Delete All
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
