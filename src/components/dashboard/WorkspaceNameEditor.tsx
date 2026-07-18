"use client";

import React, { useState, useTransition } from "react";
import { Edit2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateWorkspaceName } from "@/app/actions/workspace";

interface WorkspaceNameEditorProps {
  initialName: string;
}

export function WorkspaceNameEditor({ initialName }: WorkspaceNameEditorProps) {
  const [name, setName] = useState(initialName);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSave() {
    if (!name.trim()) {
      setError("Workspace name cannot be empty");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await updateWorkspaceName(name);
      if (res.success) {
        setIsEditing(false);
      } else {
        setError(res.error ?? "Failed to update workspace name");
      }
    });
  }

  function handleCancel() {
    setName(initialName);
    setIsEditing(false);
    setError(null);
  }

  if (isEditing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
            className="max-w-[280px] h-9 text-sm bg-white border border-hairline-strong text-ink focus-visible:ring-[#00684a] rounded-md"
            placeholder="Workspace Name"
            autoFocus
          />
          <Button
            size="icon-sm"
            onClick={handleSave}
            disabled={isPending}
            className="bg-[#00ed64] hover:bg-[#00b545] text-[#001e2b] border border-transparent rounded-full cursor-pointer"
            title="Save"
          >
            {isPending ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#001e2b] border-t-transparent" />
            ) : (
              <Check className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleCancel}
            disabled={isPending}
            className="border-hairline-strong bg-white hover:bg-slate-100 rounded-full cursor-pointer"
            title="Cancel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-base font-semibold text-ink">{name}</span>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => setIsEditing(true)}
        className="text-ink-subtle hover:text-ink hover:bg-slate-100 rounded-full cursor-pointer"
        title="Edit name"
      >
        <Edit2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
