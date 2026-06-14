import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

export async function GET(request: NextRequest) {
  try {
    // 1. Security Authorization Guard
    const authHeader = request.headers.get("Authorization");
    const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

    if (!process.env.CRON_SECRET || authHeader !== expectedToken) {
      console.error("❌ Unauthorized cron request: Authorization token mismatch");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Define target window (exactly 7 days from today)
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 7);

    // Start of the day (00:00:00.000)
    const targetStart = new Date(targetDate);
    targetStart.setHours(0, 0, 0, 0);

    // End of the day (23:59:59.999)
    const targetEnd = new Date(targetDate);
    targetEnd.setHours(23, 59, 59, 999);

    console.log(
      `⏰ Running Cron Renewal Alerting Engine. Target renewal window: ${targetStart.toISOString()} to ${targetEnd.toISOString()}`
    );

    // 3. Query Prisma database
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        nextRenewalDate: {
          gte: targetStart,
          lte: targetEnd,
        },
      },
      include: {
        workspace: {
          include: {
            members: {
              where: {
                role: "OWNER",
              },
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    console.log(`📋 Found ${subscriptions.length} active subscription(s) renewing in exactly 7 days.`);

    if (subscriptions.length === 0) {
      return NextResponse.json({ success: true, emailsSent: 0 }, { status: 200 });
    }

    // 4. Send emails using Resend
    if (!process.env.RESEND_API_KEY) {
      console.error("❌ RESEND_API_KEY is not defined in the environment");
      return NextResponse.json({ error: "Resend API key is not configured" }, { status: 500 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const emailPromises = subscriptions.map(async (sub) => {
      const ownerMember = sub.workspace.members[0];
      const emailTo = ownerMember?.user?.email;

      if (!emailTo) {
        console.warn(`⚠️ No owner email found for subscription: ${sub.id} in workspace: ${sub.workspaceId}`);
        return null;
      }

      const formattedDate = new Date(sub.nextRenewalDate).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });

      const amountStr = Number(sub.amount).toFixed(2);
      const cycleStr = sub.billingCycle.toLowerCase();

      console.log(`✉️ Sending renewal alert to ${emailTo} for ${sub.merchantName} ($${amountStr})`);

      return resend.emails.send({
        from: "SpendSync Alerts <onboarding@resend.dev>",
        to: emailTo,
        subject: `⚠️ Upcoming SaaS Renewal: ${sub.merchantName}`,
        html: `<p>Heads up! Your ${cycleStr} subscription for ${sub.merchantName} will renew for $${amountStr} on ${formattedDate}. If you no longer use this tool, cancel it today.</p>`,
      });
    });

    const results = await Promise.all(emailPromises);
    const sentCount = results.filter(Boolean).length;

    return NextResponse.json({ success: true, emailsSent: sentCount }, { status: 200 });
  } catch (error) {
    console.error("❌ Cron renewals route error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
