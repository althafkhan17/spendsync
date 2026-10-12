import { providerLabel } from "@/lib/providers/labels";

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export function renderLeakAlertEmail({
  workspaceName,
  adminName,
  provider,
  wastedAmount,
  currency = "USD",
  daysRemaining,
  dashboardUrl,
}: {
  workspaceName: string;
  adminName: string;
  provider: string;
  wastedAmount: number;
  currency?: string;
  daysRemaining: number;
  dashboardUrl: string;
}) {
  const label = providerLabel(provider);
  const accentColor = provider === "FIGMA" ? "#a259ff" : provider === "GITHUB_COPILOT" ? "#0969da" : "#00684a";
  const bulletPoints =
    provider === "FIGMA"
      ? [
          "Paid editor seats with no edit or view activity in the last 30 days.",
          "People who left the workspace but still hold an active Figma seat.",
          "Each idle seat is billed at the full editor rate on the next invoice.",
        ]
      : provider === "GITHUB_COPILOT"
        ? [
            "Assigned Copilot seats with no IDE activity in the last 30 days.",
            "Deactivated or departed accounts still occupying a seat.",
            "Idle seats are billed at the full per-seat rate every cycle.",
          ]
        : ["Licensed seats with no recorded activity in the last 30 days."];

  const bulletItemsHtml = bulletPoints
    .map((point) => `<li style="font-size: 13.5px; color: #475569; margin-bottom: 8px; line-height: 1.55;">${point}</li>`)
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Action required: ${label} seat leak</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #1e293b; line-height: 1.65; margin: 0;">
  <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border-top: 6px solid ${accentColor}; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 36px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.035);">
    <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: #64748b; text-transform: uppercase; margin-bottom: 24px;">SpendSync Optimization</div>
    <h1 style="font-size: 20px; font-weight: 850; color: #0f172a; margin: 0 0 16px 0; letter-spacing: -0.015em; line-height: 1.3;">
      Action required: ${label} is leaking ${money(wastedAmount, currency)} a month
    </h1>
    <p style="font-size: 14.5px; color: #475569; margin: 0 0 24px 0; line-height: 1.6;">
      Hello ${adminName},<br /><br />
      SpendSync found idle seats on ${label} in your <strong>${workspaceName}</strong> workspace. Remove them before the next invoice to stop paying for seats nobody uses.
    </p>
    <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 12px; padding: 22px; margin-bottom: 28px; text-align: center;">
      <span style="font-size: 32px; font-weight: 800; color: #dc2626; margin: 0 0 6px 0; display: block; letter-spacing: -0.02em;">
        ${money(wastedAmount, currency)}/mo leaking
      </span>
      <span style="font-size: 12px; font-weight: 700; color: #b45309; background-color: #fef3c7; padding: 4px 12px; border-radius: 20px; display: inline-block;">
        ⏳ ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} until renewal
      </span>
    </div>
    <h3 style="font-size: 12px; font-weight: 750; color: #334155; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 12px 0;">What we found</h3>
    <ul style="margin: 0 0 24px 0; padding-left: 20px;">
      ${bulletItemsHtml}
    </ul>
    <p style="font-size: 13.5px; color: #475569; margin: 0 0 24px 0; line-height: 1.6;">
      <strong>Next step</strong><br />
      Open SpendSync to see exactly which accounts are idle, then remove or downgrade those seats in your ${label} admin portal.
    </p>
    <a href="${dashboardUrl}" target="_blank" rel="noopener noreferrer" style="display: block; width: 100%; box-sizing: border-box; background-color: #0f172a; color: #ffffff; text-align: center; padding: 14px 24px; border-radius: 10px; font-weight: 700; font-size: 14px; text-decoration: none; margin-bottom: 28px; box-shadow: 0 2px 4px rgba(15, 23, 42, 0.1);">
      Review idle seats in SpendSync
    </a>
    <div style="text-align: center; font-size: 12px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 24px; line-height: 1.5;">
      Automated alert from your SpendSync integrations manager. Leak warnings are sent at most once every 5 days per integration.
    </div>
  </div>
</body>
</html>
  `;
}
