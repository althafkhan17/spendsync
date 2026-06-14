export function renderLeakAlertEmail({
  workspaceName,
  adminName,
  provider,
  wastedAmount,
  daysRemaining,
  dashboardUrl
}: {
  workspaceName: string;
  adminName: string;
  provider: string;
  wastedAmount: number;
  daysRemaining: number;
  dashboardUrl: string;
}) {
  const accentColor = provider === "FIGMA" ? "#a259ff" : "#0969da";
  const providerLabel = provider === "FIGMA" ? "Figma" : "GitHub Copilot";

  const bulletPoints = provider === "FIGMA"
    ? [
        "Multiple paid designer seats have shown zero edit or view activity in the last 30 days.",
        "Users have left the workspace but their paid Figma editor seats remain active.",
        "These seats are billed at the full Figma Professional/Organization editor rate."
      ]
    : [
        "Assignees have zero IDE activity or Copilot usage telemetry logged in 30 days.",
        "Deactivated organization accounts are still occupying active Copilot seats.",
        "These seats are billed at the standard Copilot Business monthly flat rate ($19.00/seat)."
      ];

  const bulletItemsHtml = bulletPoints
    .map(point => `
      <li style="font-size: 13.5px; color: #475569; margin-bottom: 8px; line-height: 1.55;">${point}</li>
    `)
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Action Required: Reduce active leak on ${providerLabel}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #1e293b; line-height: 1.65; margin: 0;">
  <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border-top: 6px solid ${accentColor}; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 36px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.035);">
    <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: #64748b; text-transform: uppercase; margin-bottom: 24px;">SpendSync Optimization</div>
    
    <h1 style="font-size: 20px; font-weight: 850; color: #0f172a; margin: 0 0 16px 0; letter-spacing: -0.015em; line-height: 1.3;">
      Action Required: Reduce active leak on ${providerLabel}
    </h1>
    
    <p style="font-size: 14.5px; color: #475569; margin: 0 0 24px 0; line-height: 1.6;">
      Hello ${adminName},<br /><br />
      Our automated optimization engine has detected an active seat leakage in your <strong>${workspaceName}</strong> workspace. We recommend pruning these seats before the next billing cycle to avoid unwanted charges.
    </p>

    <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 12px; padding: 22px; margin-bottom: 28px; text-align: center;">
      <span style="font-size: 32px; font-weight: 800; color: #dc2626; margin: 0 0 6px 0; display: block; letter-spacing: -0.02em;">
        $${wastedAmount.toFixed(2)}/mo leaking
      </span>
      <span style="font-size: 12px; font-weight: 700; color: #b45309; background-color: #fef3c7; padding: 4px 12px; border-radius: 20px; display: inline-block;">
        ⏳ Only ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left until renewal!
      </span>
    </div>

    <h3 style="font-size: 12px; font-weight: 750; color: #334155; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 12px 0;">Optimization Details:</h3>
    <ul style="margin: 0 0 24px 0; padding-left: 20px;">
      ${bulletItemsHtml}
    </ul>

    <p style="font-size: 13.5px; color: #475569; margin: 0 0 24px 0; line-height: 1.6;">
      <strong>What should you do next?</strong><br />
      Click the button below to log into SpendSync and view the specific list of idle or unassigned user accounts. You can then use this list to safely remove or downgrade their licenses directly in your ${providerLabel} admin portal to stop the leak.
    </p>

    <a href="${dashboardUrl}" target="_blank" rel="noopener noreferrer" style="display: block; width: 100%; box-sizing: border-box; background-color: #0f172a; color: #ffffff; text-align: center; padding: 14px 24px; border-radius: 10px; font-weight: 700; font-size: 14px; text-decoration: none; margin-bottom: 28px; box-shadow: 0 2px 4px rgba(15, 23, 42, 0.1);">
      Optimize Seats on SpendSync Dashboard
    </a>

    <div style="text-align: center; font-size: 12px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 24px; line-height: 1.5;">
      This is an automated alert sent from your SpendSync integrations manager.<br />
      To configure your warning notification rules, go to Workspace Settings.
    </div>
  </div>
</body>
</html>
  `;
}
