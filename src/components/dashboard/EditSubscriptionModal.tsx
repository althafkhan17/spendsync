"use client";

import React, { useState, useRef, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateSubscription } from "@/app/actions/subscriptions";
import type { SubscriptionRow } from "@/app/actions/subscriptions";

interface EditSubscriptionModalProps {
  subscription: SubscriptionRow;
  children: React.ReactNode;
}

function formatDateForInput(date: Date): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function EditSubscriptionModal({
  subscription,
  children,
}: EditSubscriptionModalProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateSubscription(subscription.id, formData);
      if (result.success) {
        setOpen(false);
      } else {
        setError(result.error ?? "Something went wrong");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center">
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-slate-900">
            Edit Subscription
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            Update the details for {subscription.merchantName}.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={handleSubmit} className="space-y-5 pt-2">
          {/* Merchant Name */}
          <div className="space-y-2">
            <Label
              htmlFor="edit-merchantName"
              className="text-sm font-medium text-slate-700"
            >
              Merchant Name
            </Label>
            <Input
              id="edit-merchantName"
              name="merchantName"
              defaultValue={subscription.merchantName}
              placeholder="e.g. Figma, Vercel, Notion"
              required
              className="h-10"
            />
          </div>

          {/* Amount + Cycle Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label
                htmlFor="edit-amount"
                className="text-sm font-medium text-slate-700"
              >
                Amount ($)
              </Label>
              <Input
                id="edit-amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={Number(subscription.amount).toString()}
                placeholder="29.99"
                required
                className="h-10 tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="edit-billingCycle"
                className="text-sm font-medium text-slate-700"
              >
                Billing Cycle
              </Label>
              <Select
                name="billingCycle"
                defaultValue={subscription.billingCycle}
                required
              >
                <SelectTrigger id="edit-billingCycle" className="h-10">
                  <SelectValue placeholder="Select cycle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="ANNUAL">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Next Renewal Date */}
          <div className="space-y-2">
            <Label
              htmlFor="edit-nextRenewalDate"
              className="text-sm font-medium text-slate-700"
            >
              Next Renewal Date
            </Label>
            <Input
              id="edit-nextRenewalDate"
              name="nextRenewalDate"
              type="date"
              defaultValue={formatDateForInput(subscription.nextRenewalDate)}
              required
              className="h-10"
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label
              htmlFor="edit-status"
              className="text-sm font-medium text-slate-700"
            >
              Status
            </Label>
            <Select
              name="status"
              defaultValue={subscription.status}
              required
            >
              <SelectTrigger id="edit-status" className="h-10">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="NEEDS_REVIEW">Needs Review</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Error message */}
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="h-10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="h-10 gap-2 bg-slate-900 text-white hover:bg-slate-800"
            >
              {isPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
