"use server";

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
  currency: string;
  confidenceScore: number | null;
  createdAt: Date;
  subscriptionId: string | null;
  subscription?: {
    merchantName: string;
  } | null;
};

function extractCurrency(raw: string | null): string {
  if (!raw) return "USD";
  try {
    const parsed = JSON.parse(raw);
    const c = typeof parsed?.currency === "string" ? parsed.currency.trim().toUpperCase() : "";
    return /^[A-Z]{3}$/.test(c) ? c : "USD";
  } catch {
    return "USD";
  }
}

export async function getEmailLogs(): Promise<EmailLogRow[]> {
  const { workspaceId } = await ensureUserAndWorkspace();

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
    currency: extractCurrency(log.rawExtraction),
    confidenceScore: log.confidenceScore,
    createdAt: log.createdAt,
    subscriptionId: log.subscriptionId,
    subscription: log.subscription,
  }));
}
