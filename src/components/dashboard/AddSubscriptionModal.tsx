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
        className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
        id="add-subscription-btn"
      >
        <Plus className="h-4 w-4" />
        Add Subscription
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-slate-900">
            Add Subscription
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            Track a new SaaS subscription. Fill in the details below.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={handleSubmit} className="space-y-5 pt-2">
          {/* Merchant Name */}
          <div className="space-y-2">
            <Label htmlFor="merchantName" className="text-sm font-medium text-slate-700">
              Merchant Name
            </Label>
            <Input
              id="merchantName"
              name="merchantName"
              placeholder="e.g. Figma, Vercel, Notion"
              required
              className="h-10"
            />
          </div>

          {/* Amount + Cycle Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-sm font-medium text-slate-700">
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
                className="h-10 tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingCycle" className="text-sm font-medium text-slate-700">
                Billing Cycle
              </Label>
              <Select name="billingCycle" defaultValue="MONTHLY" required>
                <SelectTrigger id="billingCycle" className="h-10">
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
            <Label htmlFor="nextRenewalDate" className="text-sm font-medium text-slate-700">
              Next Renewal Date
            </Label>
            <Input
              id="nextRenewalDate"
              name="nextRenewalDate"
              type="date"
              required
              className="h-10"
            />
          </div>

          {/* Hidden status field — defaults to ACTIVE */}
          <input type="hidden" name="status" value="ACTIVE" />

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
