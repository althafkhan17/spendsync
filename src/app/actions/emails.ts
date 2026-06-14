"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { ensureUserAndWorkspace } from "@/lib/auth-sync";

export type EmailLogRow = {
  id: string;
  senderEmail: string;
  subject: string;
  bodyPreview: string;
  source: string;
  attachmentName: string | null;
  wasReceipt: boolean;
  merchantName: string | null;
  amount: number | null;
  confidenceScore: number | null;
  createdAt: Date;
  subscriptionId: string | null;
  subscription?: {
    merchantName: string;
  } | null;
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

export async function getEmailLogs(): Promise<EmailLogRow[]> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    throw new Error("Unauthorized access");
  }

  const { workspaceId } = await ensureUserAndWorkspace();

  await verifyWorkspaceAccess(workspaceId, clerkId);

  const logs = await prisma.emailLog.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    include: {
      subscription: {
        select: {
          merchantName: true,
        },
      },
    },
  });

  return logs.map((log) => ({
    id: log.id,
    senderEmail: log.senderEmail,
    subject: log.subject,
    bodyPreview: log.bodyPreview,
    source: log.source,
    attachmentName: log.attachmentName,
    wasReceipt: log.wasReceipt,
    merchantName: log.merchantName,
    amount: log.amount ? Number(log.amount) : null,
    confidenceScore: log.confidenceScore,
    createdAt: log.createdAt,
    subscriptionId: log.subscriptionId,
    subscription: log.subscription,
  }));
}
