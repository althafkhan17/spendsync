"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { ensureUserAndWorkspace } from "@/lib/auth-sync";

export type WorkspaceDetails = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  memberCount: number;
  ownerEmail: string;
  routingEmail: string;
};

// Helper: Verify workspace membership access (IDOR Guard)
async function verifyWorkspaceAccess(workspaceId: string, clerkId: string): Promise<void> {
  const count = await prisma.workspace.count({
    where: {
      id: workspaceId,
      members: {
        some: {
          user: {
            clerkId,
          },
        },
      },
    },
  });
  if (count === 0) {
    throw new Error("Unauthorized access");
  }
}

export async function getWorkspaceDetails(): Promise<WorkspaceDetails> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    throw new Error("Unauthorized access");
  }

  const { workspaceId } = await ensureUserAndWorkspace();

  await verifyWorkspaceAccess(workspaceId, clerkId);

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
  const routingEmail = `ac863b2208948441ba11+${workspace.id}@cloudmailin.net`;

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
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      throw new Error("Unauthorized access");
    }

    const { workspaceId } = await ensureUserAndWorkspace();

    await verifyWorkspaceAccess(workspaceId, clerkId);

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
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      throw new Error("Unauthorized access");
    }

    const { workspaceId } = await ensureUserAndWorkspace();

    await verifyWorkspaceAccess(workspaceId, clerkId);

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
