"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ensureUserAndWorkspace } from "@/lib/auth-sync";
import { getWorkspaceRoutingEmail } from "@/lib/env";

export type WorkspaceDetails = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  memberCount: number;
  ownerEmail: string;
  routingEmail: string;
};

export async function getWorkspaceDetails(): Promise<WorkspaceDetails> {
  const { workspaceId } = await ensureUserAndWorkspace();

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      members: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!workspace) {
    throw new Error("Workspace not found");
  }

  // Find owner's email
  const ownerMember = workspace.members.find((m) => m.role === "OWNER") || workspace.members[0];
  const ownerEmail = ownerMember?.user?.email || "unknown@domain.com";

  // Construct CloudMailin routing address
  const routingEmail = getWorkspaceRoutingEmail(workspace.id);

  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    createdAt: workspace.createdAt,
    memberCount: workspace.members.length,
    ownerEmail,
    routingEmail,
  };
}

export async function updateWorkspaceName(
  name: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { workspaceId } = await ensureUserAndWorkspace();

    if (!name?.trim()) {
      return { success: false, error: "Workspace name is required" };
    }

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: name.trim() },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");

    return { success: true };
  } catch (error) {
    console.error("Failed to update workspace name:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

export async function deleteAllSubscriptions(): Promise<{ success: boolean; error?: string }> {
  try {
    const { workspaceId } = await ensureUserAndWorkspace();

    await prisma.subscription.deleteMany({
      where: { workspaceId },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/subscriptions");

    return { success: true };
  } catch (error) {
    console.error("Failed to delete all subscriptions:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}
