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
      <DialogContent className="sm:max-w-[480px] bg-white border border-hairline text-ink rounded-lg shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-ink">
            Edit Subscription
          </DialogTitle>
          <DialogDescription className="text-sm text-[#5c6c7a]">
            Update the details for {subscription.merchantName}.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={handleSubmit} className="space-y-5 pt-2">
          {/* Merchant Name */}
          <div className="space-y-2">
            <Label
              htmlFor="edit-merchantName"
              className="text-sm font-semibold text-ink"
            >
              Merchant Name
            </Label>
            <Input
              id="edit-merchantName"
              name="merchantName"
              defaultValue={subscription.merchantName}
              placeholder="e.g. Figma, Vercel, Notion"
              required
              className="h-11 bg-white border border-hairline-strong text-ink focus-visible:ring-[#00684a] rounded-md"
            />
          </div>

          {/* Amount + Cycle Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label
                htmlFor="edit-amount"
                className="text-sm font-semibold text-ink"
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
                className="h-11 bg-white border border-hairline-strong text-ink focus-visible:ring-[#00684a] rounded-md tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="edit-billingCycle"
                className="text-sm font-semibold text-ink"
              >
                Billing Cycle
              </Label>
              <Select
                name="billingCycle"
                defaultValue={subscription.billingCycle}
                required
              >
                <SelectTrigger id="edit-billingCycle" className="h-11 bg-white border border-hairline-strong text-ink focus-visible:ring-[#00684a] rounded-md">
                  <SelectValue placeholder="Select cycle" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-hairline text-ink rounded-md">
                  <SelectItem value="MONTHLY" className="focus:bg-[#f4f7f6] cursor-pointer">Monthly</SelectItem>
                  <SelectItem value="ANNUAL" className="focus:bg-[#f4f7f6] cursor-pointer">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Next Renewal Date */}
          <div className="space-y-2">
            <Label
              htmlFor="edit-nextRenewalDate"
              className="text-sm font-semibold text-ink"
            >
              Next Renewal Date
            </Label>
            <Input
              id="edit-nextRenewalDate"
              name="nextRenewalDate"
              type="date"
              defaultValue={formatDateForInput(subscription.nextRenewalDate)}
              required
              className="h-11 bg-white border border-hairline-strong text-ink focus-visible:ring-[#00684a] rounded-md"
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label
              htmlFor="edit-status"
              className="text-sm font-semibold text-ink"
            >
              Status
            </Label>
            <Select
              name="status"
              defaultValue={subscription.status}
              required
            >
              <SelectTrigger id="edit-status" className="h-11 bg-white border border-hairline-strong text-ink focus-visible:ring-[#00684a] rounded-md">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-hairline text-ink rounded-md">
                <SelectItem value="ACTIVE" className="focus:bg-[#f4f7f6] cursor-pointer">Active</SelectItem>
                <SelectItem value="CANCELLED" className="focus:bg-[#f4f7f6] cursor-pointer">Cancelled</SelectItem>
                <SelectItem value="NEEDS_REVIEW" className="focus:bg-[#f4f7f6] cursor-pointer">Needs Review</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Error message */}
          {error && (
            <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          {/* Submit */}
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
              type="submit"
              disabled={isPending}
              className="h-10 rounded-full bg-[#00ed64] hover:bg-[#00b545] text-[#001e2b] font-semibold px-5 border border-transparent disabled:opacity-60"
            >
              {isPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#001e2b] border-t-transparent" />
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
