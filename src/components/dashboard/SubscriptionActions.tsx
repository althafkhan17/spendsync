"use client";

import React, { useState, useTransition } from "react";
import { Pencil, Ban, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EditSubscriptionModal } from "@/components/dashboard/EditSubscriptionModal";
import {
  deleteSubscription,
  cancelSubscription,
  reactivateSubscription,
} from "@/app/actions/subscriptions";
import type { SubscriptionRow } from "@/app/actions/subscriptions";

interface SubscriptionActionsProps {
  subscription: SubscriptionRow;
}

export function SubscriptionActions({ subscription }: SubscriptionActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isToggling, startToggleTransition] = useTransition();

  const isCancelled = subscription.status === "CANCELLED";

  function handleToggleStatus() {
    startToggleTransition(async () => {
      if (isCancelled) {
        await reactivateSubscription(subscription.id);
      } else {
        await cancelSubscription(subscription.id);
      }
    });
  }

  function handleDelete() {
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteSubscription(subscription.id);
      if (result.success) {
        setDeleteOpen(false);
      } else {
        setDeleteError(result.error ?? "Failed to delete subscription");
      }
    });
  }

  return (
    <div className="flex items-center gap-1">
      {/* Edit Button — triggers EditSubscriptionModal */}
      <EditSubscriptionModal subscription={subscription}>
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          title="Edit"
        >
          <Pencil className="h-4 w-4" />
        </span>
      </EditSubscriptionModal>

      {/* Cancel / Reactivate Button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleToggleStatus}
        disabled={isToggling}
        title={isCancelled ? "Reactivate" : "Cancel"}
        className="text-slate-400 hover:text-slate-600"
      >
        {isToggling ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
        ) : isCancelled ? (
          <RotateCcw className="h-4 w-4" />
        ) : (
          <Ban className="h-4 w-4" />
        )}
      </Button>

      {/* Delete Button — opens confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogTrigger
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </DialogTrigger>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-900">
              Delete Subscription
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Are you sure you want to delete{" "}
              <span className="font-medium text-slate-700">
                {subscription.merchantName}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {deleteError}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              className="h-10"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDelete}
              className="h-10 gap-2"
            >
              {isDeleting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
