import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * Ensures the currently logged-in Clerk user has a corresponding
 * User + Workspace row in the database. Called on every dashboard
 * page load (results are cached per-request by Next.js).
 *
 * Returns the user's active workspaceId.
 */
export async function ensureUserAndWorkspace(): Promise<{
  userId: string;
  workspaceId: string;
}> {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    throw new Error("Unauthorized — no active Clerk session");
  }

  // Check if the user already exists in our DB
  const existingUser = await prisma.user.findUnique({
    where: { clerkId },
    include: {
      memberships: {
        include: { workspace: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  if (existingUser && existingUser.memberships.length > 0) {
    return {
      userId: existingUser.id,
      workspaceId: existingUser.memberships[0].workspaceId,
    };
  }

  // User doesn't exist — create them + a default workspace
  const clerkUser = await currentUser();
  const email =
    clerkUser?.emailAddresses?.[0]?.emailAddress ?? `${clerkId}@unknown.com`;
  const name =
    clerkUser?.firstName && clerkUser?.lastName
      ? `${clerkUser.firstName} ${clerkUser.lastName}`
      : clerkUser?.firstName ?? null;
  const imageUrl = clerkUser?.imageUrl ?? null;

  // Generate a URL-safe slug from email prefix
  const slug =
    email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-") +
    "-" +
    Date.now().toString(36);

  const workspaceName = name ? `${name}'s Workspace` : "Personal Workspace";

  // Use a transaction to create User + Workspace + Membership atomically
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { clerkId },
      update: { email, name, imageUrl },
      create: { clerkId, email, name, imageUrl },
    });

    // Check if user already has a workspace (race condition guard)
    const existingMembership = await tx.workspaceMember.findFirst({
      where: { userId: user.id },
    });

    if (existingMembership) {
      return { userId: user.id, workspaceId: existingMembership.workspaceId };
    }

    const workspace = await tx.workspace.create({
      data: {
        name: workspaceName,
        slug,
        members: {
          create: {
            userId: user.id,
            role: "OWNER",
          },
        },
      },
    });

    return { userId: user.id, workspaceId: workspace.id };
  });

  return result;
}
