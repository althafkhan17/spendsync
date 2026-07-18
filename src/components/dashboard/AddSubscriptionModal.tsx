"use client";

import React, { useState, useRef, useTransition } from "react";
import { Plus } from "lucide-react";
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
import { addSubscription } from "@/app/actions/subscriptions";

export function AddSubscriptionModal() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addSubscription(formData);
      if (result.success) {
        setOpen(false);
        formRef.current?.reset();
      } else {
        setError(result.error ?? "Something went wrong");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="inline-flex items-center justify-center gap-2 rounded-full bg-[#00ed64] hover:bg-[#00b545] px-5 py-2 text-sm font-semibold text-[#001e2b] shadow-sm transition-colors cursor-pointer border border-transparent focus-visible:outline-none"
        id="add-subscription-btn"
      >
        <Plus className="h-4 w-4" />
        Add Subscription
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] bg-white border border-hairline text-ink rounded-lg shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-ink">
            Add Subscription
          </DialogTitle>
          <DialogDescription className="text-sm text-[#5c6c7a]">
            Track a new SaaS subscription. Fill in the details below.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={handleSubmit} className="space-y-5 pt-2">
          {/* Merchant Name */}
          <div className="space-y-2">
            <Label htmlFor="merchantName" className="text-sm font-semibold text-ink">
              Merchant Name
            </Label>
            <Input
              id="merchantName"
              name="merchantName"
              placeholder="e.g. Figma, Vercel, Notion"
              required
              className="h-11 bg-white border border-hairline-strong text-ink focus-visible:ring-[#00684a] rounded-md"
            />
          </div>

          {/* Amount + Cycle Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-sm font-semibold text-ink">
                Amount ($)
              </Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="29.99"
                required
                className="h-11 bg-white border border-hairline-strong text-ink focus-visible:ring-[#00684a] rounded-md tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingCycle" className="text-sm font-semibold text-ink">
                Billing Cycle
              </Label>
              <Select name="billingCycle" defaultValue="MONTHLY" required>
                <SelectTrigger id="billingCycle" className="h-11 bg-white border border-hairline-strong text-ink focus-visible:ring-[#00684a] rounded-md">
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
            <Label htmlFor="nextRenewalDate" className="text-sm font-semibold text-ink">
              Next Renewal Date
            </Label>
            <Input
              id="nextRenewalDate"
              name="nextRenewalDate"
              type="date"
              required
              className="h-11 bg-white border border-hairline-strong text-ink focus-visible:ring-[#00684a] rounded-md"
            />
          </div>

          {/* Hidden status field — defaults to ACTIVE */}
          <input type="hidden" name="status" value="ACTIVE" />

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
                  Adding...
                </>
              ) : (
                "Add Subscription"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
