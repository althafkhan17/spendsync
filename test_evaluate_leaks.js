const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log("🧪 STARTING EVALUATE-LEAKS ENDPOINT VERIFICATION TEST");
    console.log("══════════════════════════════════════════════════");

    // 1. Check if there are any active integrations with wastedAmount > 0
    let integration = await prisma.integration.findFirst({
      where: {
        isActive: true,
        wastedAmount: { gt: 0 }
      },
      include: { workspace: true }
    });

    if (!integration) {
      console.log("⚠️ No active integration with wastedAmount > 0 found. Creating mock integration for test...");
      // Find a workspace
      let workspace = await prisma.workspace.findFirst();
      if (!workspace) {
        workspace = await prisma.workspace.create({
          data: {
            name: "Mock Test Workspace",
            slug: "mock-test-workspace-" + Date.now()
          }
        });
        console.log(`✅ Created Mock Workspace: ID=${workspace.id}`);
      }

      integration = await prisma.integration.create({
        data: {
          provider: "GITHUB_COPILOT",
          accessToken: "mock_test_token_123",
          refreshToken: "mock-test-org",
          isActive: true,
          wastedSeats: 1,
          wastedAmount: 19.00,
          workspaceId: workspace.id
        },
        include: { workspace: true }
      });
      console.log(`✅ Created Mock Integration: ID=${integration.id}, provider=${integration.provider}, wastedAmount=$${integration.wastedAmount}`);
    } else {
      console.log(`📌 Found active integration with leak: ID=${integration.id}, provider=${integration.provider}, wastedAmount=$${integration.wastedAmount}, workspace="${integration.workspace.name}"`);
    }

    // Reset lastWarningSentAt to null for this test to bypass throttle
    await prisma.integration.update({
      where: { id: integration.id },
      data: { lastWarningSentAt: null }
    });
    console.log("🔄 Reset lastWarningSentAt to null to ensure warning flags run cleanly.");

    // Create a mock receipt (EmailLog) for this workspace that is 24 days old
    // This places the renewal date 30 days later, which is exactly 6 days from now (inside the 1-7 days gate!)
    const mockInvoiceDate = new Date();
    mockInvoiceDate.setDate(mockInvoiceDate.getDate() - 24);

    // Delete existing logs for this workspace to start clean
    await prisma.emailLog.deleteMany({
      where: { workspaceId: integration.workspaceId, wasReceipt: true }
    });

    const mockEmailLog = await prisma.emailLog.create({
      data: {
        senderEmail: "billing@github.com",
        subject: "Invoice for GitHub Copilot seats",
        bodyPreview: "Receipt for GitHub Copilot seats billing details...",
        wasReceipt: true,
        merchantName: "GitHub",
        amount: 190.00,
        createdAt: mockInvoiceDate,
        workspaceId: integration.workspaceId
      }
    });
    console.log(`✅ Created Mock Receipt (Invoice Date baseline): Date=${mockInvoiceDate.toLocaleDateString()}, ID=${mockEmailLog.id}`);

    const response = await fetch("http://localhost:3000/api/cron/evaluate-leaks");

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP fetch failed with status ${response.status}: ${errText}`);
    }

    const payload = await response.json();
    console.log("🎉 Cron API responded successfully!");
    console.log("══════════════════════════════════════════════════");
    console.log(JSON.stringify(payload, null, 2));
    console.log("══════════════════════════════════════════════════");

    // 2. Fetch the integration again to verify lastWarningSentAt was updated to today
    const updatedIntegration = await prisma.integration.findUnique({
      where: { id: integration.id }
    });

    console.log("🔍 Checking database for updated warnings timestamp:");
    if (updatedIntegration.lastWarningSentAt) {
      console.log(`✅ SUCCESS: lastWarningSentAt was updated to: ${updatedIntegration.lastWarningSentAt.toISOString()}`);
    } else {
      console.error("❌ FAILURE: lastWarningSentAt remained null!");
    }

    // 3. Trigger endpoint again to test throttling (since warning was sent just now, it should get throttled/skipped!)
    console.log("\n📡 Triggering evaluate-leaks again to verify anti-spam throttle...");
    const response2 = await fetch("http://localhost:3000/api/cron/evaluate-leaks");
    const payload2 = await response2.json();
    
    console.log("🎉 Throttle verification response received:");
    console.log(`   Processed: ${payload2.processedCount}, Flagged: ${payload2.flaggedCount}`);
    
    const isSkipped = payload2.skipped && payload2.skipped.some(s => s.integrationId === integration.id && !s.passesThrottle);
    if (isSkipped) {
      console.log("⭐ SUCCESS: Integration was correctly throttled and skipped on second run! ⭐");
    } else {
      console.error("❌ FAILURE: Integration was not skipped or throttled!");
    }

  } catch (error) {
    console.error("❌ Test script error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
