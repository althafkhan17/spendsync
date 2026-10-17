const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function runAllTests() {
  console.log("==================================================");
  console.log("🔍 SPENDSYNC END-TO-END AUTOMATED TEST SUITE");
  console.log("==================================================\n");

  // Step 1: Check Database & Retrieve a Valid Workspace
  console.log("🔄 Step 1: Checking database connectivity & active workspaces...");
  let workspace;
  try {
    workspace = await prisma.workspace.findFirst({
      include: {
        members: {
          include: {
            user: true
          }
        }
      }
    });
  } catch (err) {
    console.error("❌ Database connection failed. Please ensure Prisma and your local env are set up correctly.");
    console.error(err);
    process.exit(1);
  }

  if (!workspace) {
    console.warn("\n⚠️  No workspaces found in the database!");
    console.warn("👉 Please perform the following manual setup first:");
    console.warn("   1. Run the Next.js dev server: npm run dev");
    console.warn("   2. Open http://localhost:3000/dashboard in your browser.");
    console.warn("   3. Register/Sign in via Clerk. This will automatically sync your user and create a workspace in the database.");
    console.warn("   4. Once signed in, run this test script again.\n");
    await prisma.$disconnect();
    return;
  }

  const workspaceId = workspace.id;
  const ownerEmail = workspace.members[0]?.user?.email || "owner@example.com";
  console.log(`✅ Found active Workspace: "${workspace.name}" (ID: ${workspaceId})`);
  console.log(`✅ Associated Owner Email: "${ownerEmail}"\n`);

  // Define URLs
  const baseUrl = "http://localhost:3000";
  const webhookSecret = process.env.WEBHOOK_SECRET || "emora";
  const cronSecret = process.env.CRON_SECRET || "my_super_secret_cro";

  // Cleanup old test subscriptions to keep test run clean
  console.log("🧹 Cleaning up old test subscriptions for AWS/Figma...");
  await prisma.subscription.deleteMany({
    where: {
      workspaceId,
      merchantName: { in: ["AWS", "Figma", "Amazon Web Services"], mode: "insensitive" }
    }
  });

  // Test 1: Public Landing Page
  console.log("\n--- TEST 1: Requesting public root '/' path ---");
  try {
    const res = await fetch(`${baseUrl}/`);
    console.log(`Status: ${res.status} ${res.statusText}`);
    const text = await res.text();
    const hasMarketingText = text.includes("AI-Powered SaaS Spend Tracking");
    console.log(`Renders public marketing page: ${hasMarketingText ? "✅ YES" : "❌ NO"}`);
  } catch (err) {
    console.error("❌ Test 1 failed:", err.message);
  }

  // Test 2: Protected Dashboard (Clerk Redirect Check)
  console.log("\n--- TEST 2: Requesting protected '/dashboard' path ---");
  try {
    const res = await fetch(`${baseUrl}/dashboard`, { redirect: "manual" });
    console.log(`Status: ${res.status} ${res.statusText}`);
    const location = res.headers.get("location") || "";
    const isRedirectedToClerk = res.status === 307 || location.includes("clerk");
    console.log(`Redirects unauthenticated user to Clerk: ${isRedirectedToClerk ? "✅ YES" : "❌ NO"}`);
    if (location) console.log(`Redirect location: ${location}`);
  } catch (err) {
    console.error("❌ Test 2 failed:", err.message);
  }

  // Test 3: Inbound Webhook Unauthorized Check
  console.log("\n--- TEST 3: Webhook Ingestion (Security Mismatch Check) ---");
  try {
    const res = await fetch(`${baseUrl}/api/webhooks/inbound?secret=wrong-secret`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plain: "test" })
    });
    console.log(`Status: ${res.status} ${res.statusText}`);
    console.log(`Blocks wrong secret with 401 Unauthorized: ${res.status === 401 ? "✅ YES" : "❌ NO"}`);
  } catch (err) {
    console.error("❌ Test 3 failed:", err.message);
  }

  // Test 4: Webhook Ingestion Success (AWS Invoice Parsing via Gemini & Prisma Store)
  console.log("\n--- TEST 4: Webhook Ingestion (AWS Subscription Ingestion via LLM) ---");
  const awsPayload = {
    headers: {
      from: "billing@aws.amazon.com",
      to: `ac863b2208948441ba11+${workspaceId}@cloudmailin.net`,
      subject: "Your AWS Billing Receipt"
    },
    envelope: {
      from: "billing@aws.amazon.com",
      to: `ac863b2208948441ba11+${workspaceId}@cloudmailin.net`,
      recipients: [`ac863b2208948441ba11+${workspaceId}@cloudmailin.net`]
    },
    plain: `Hi customer,
Here is your billing statement for Amazon Web Services.
Billing Period: June 1 - June 30, 2026
Billing Cycle: Monthly
Charges Detail: EC2 Instances - $49.00, S3 Bucket Storage - $15.50
Total Amount Due: $64.50 USD
Best regards,
Amazon Web Services`
  };

  try {
    console.log("Sending mock email payload to Webhook route...");
    const res = await fetch(`${baseUrl}/api/webhooks/inbound?secret=${webhookSecret}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(awsPayload)
    });
    console.log(`Status: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log("Webhook Response:", JSON.stringify(data, null, 2));

    // Verify DB insertion
    console.log("Querying database to check if subscription was saved...");
    const subscription = await prisma.subscription.findFirst({
      where: {
        workspaceId,
        merchantName: { in: ["AWS", "Amazon Web Services"], mode: "insensitive" }
      }
    });

    if (subscription) {
      console.log(`✅ Subscription saved successfully!`);
      console.log(`   Merchant: ${subscription.merchantName}`);
      console.log(`   Amount:   $${subscription.amount} ${subscription.currency}`);
      console.log(`   Cycle:    ${subscription.billingCycle}`);
      console.log(`   Renewal:  ${subscription.nextRenewalDate.toISOString().split("T")[0]}`);
      console.log(`   Confidence: ${(subscription.confidenceScore * 100).toFixed(0)}%`);
    } else {
      console.error(`❌ Subscription for AWS was not found in the database!`);
    }
  } catch (err) {
    console.error("❌ Test 4 failed:", err.message);
  }

  // Test 5: Cron Alerting API Unauthorized Check
  console.log("\n--- TEST 5: Cron Renewal Alerts (Security Mismatch Check) ---");
  try {
    const res = await fetch(`${baseUrl}/api/cron/renewals`);
    console.log(`Status: ${res.status} ${res.statusText}`);
    console.log(`Blocks missing token with 401 Unauthorized: ${res.status === 401 ? "✅ YES" : "❌ NO"}`);
  } catch (err) {
    console.error("❌ Test 5 failed:", err.message);
  }

  // Test 6: Cron Renewal Alerts Success Check
  console.log("\n--- TEST 6: Cron Renewal Alerts Success Check (Resend Alert Dispatch) ---");
  try {
    // Let's modify the AWS subscription renewal date in the DB to be exactly 7 days from now,
    // so that it matches the time window queried by the cron job!
    const targetRenewalDate = new Date();
    targetRenewalDate.setDate(targetRenewalDate.getDate() + 7);
    targetRenewalDate.setHours(12, 0, 0, 0); // mid-day to avoid TZ edge cases

    console.log(`Temporarily updating AWS subscription renewal date to: ${targetRenewalDate.toISOString().split("T")[0]}`);
    await prisma.subscription.updateMany({
      where: {
        workspaceId,
        merchantName: { in: ["AWS", "Amazon Web Services"], mode: "insensitive" }
      },
      data: {
        nextRenewalDate: targetRenewalDate,
        status: "ACTIVE"
      }
    });

    console.log("Triggering Daily Cron renewals endpoint...");
    const res = await fetch(`${baseUrl}/api/cron/renewals`, {
      headers: {
        "Authorization": `Bearer ${cronSecret}`
      }
    });
    console.log(`Status: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log("Cron Response:", JSON.stringify(data, null, 2));
    console.log(`Sends email alerts: ${data.success ? "✅ YES" : "❌ NO"}`);
  } catch (err) {
    console.error("❌ Test 6 failed:", err.message);
  }

  console.log("\n==================================================");
  console.log("🏁 TESTS COMPLETED");
  console.log("==================================================");

  await prisma.$disconnect();
}

runAllTests();
