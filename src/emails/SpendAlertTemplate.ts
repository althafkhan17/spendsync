import type { ModelSpend } from "@/lib/audit-report";
import { prettyModelName } from "@/lib/providers/anthropic";

export function renderSpendAlertEmail({
  workspaceName,
  adminName,
  totalCostUsd,
  thresholdUsd,
  topModels,
  dashboardUrl,
  dataSource,
}: {
  workspaceName: string;
  adminName: string;
  totalCostUsd: number;
  thresholdUsd: number;
  topModels: ModelSpend[];
  dashboardUrl: string;
  dataSource: "LIVE" | "SIMULATED";
}): string {
  const pct = Math.round((totalCostUsd / Math.max(thresholdUsd, 0.01)) * 100);
  const rows = topModels
    .map(
      (m) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #1c2d38;font-size:13px;color:#c1ccd6;">${prettyModelName(m.model)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #1c2d38;font-size:13px;color:#ffffff;text-align:right;font-weight:600;">$${m.costUsd.toFixed(2)}</td>
      </tr>`
    )
    .join("");
  const sourceNote =
    dataSource === "LIVE"
      ? "Figures come from the Anthropic Usage & Cost API."
      : "Figures are simulated because this workspace is not connected with an Admin API key.";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Anthropic spend over budget</title></head>
<body style="margin:0;padding:32px 16px;background:#f4f7f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="background:#001e2b;color:#ffffff;padding:32px;border-radius:12px;max-width:600px;margin:0 auto;border:1px solid #1c2d38;">
    <div style="border-bottom:1px solid #1c2d38;padding-bottom:16px;margin-bottom:22px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#8fa0ad;text-transform:uppercase;margin-bottom:6px;">SpendSync Budget Guard</div>
      <h2 style="margin:0;font-size:20px;font-weight:700;">Anthropic spend is ${pct}% of budget</h2>
    </div>
    <p style="font-size:14px;color:#c1ccd6;line-height:1.6;margin:0 0 20px 0;">
      Hi ${adminName}, the <strong style="color:#ffffff;">${workspaceName}</strong> workspace has crossed its monthly safety threshold for the Anthropic Claude API.
    </p>
    <div style="background:#002535;border:1px solid #1c2d38;border-radius:8px;padding:20px;margin:0 0 22px 0;">
      <div style="display:flex;justify-content:space-between;">
        <div style="margin-bottom:12px;">
          <span style="font-size:10px;text-transform:uppercase;color:#8fa0ad;font-weight:700;display:block;letter-spacing:.05em;">Month-to-date spend</span>
          <span style="font-size:24px;color:#00ed64;font-weight:800;">$${totalCostUsd.toFixed(2)}</span>
        </div>
      </div>
      <div>
        <span style="font-size:10px;text-transform:uppercase;color:#8fa0ad;font-weight:700;display:block;letter-spacing:.05em;">Safety threshold</span>
        <span style="font-size:16px;color:#ffffff;font-weight:700;">$${thresholdUsd.toFixed(2)} / month</span>
      </div>
      <div style="height:8px;background:#1c2d38;border-radius:999px;margin-top:16px;overflow:hidden;">
        <div style="height:8px;width:${Math.min(100, pct)}%;background:#ff8a8a;border-radius:999px;"></div>
      </div>
    </div>
    ${rows ? `<table style="width:100%;border-collapse:collapse;margin-bottom:22px;"><thead><tr><th style="text-align:left;font-size:10px;color:#8fa0ad;text-transform:uppercase;letter-spacing:.05em;padding-bottom:6px;">Top models</th><th style="text-align:right;font-size:10px;color:#8fa0ad;text-transform:uppercase;letter-spacing:.05em;padding-bottom:6px;">Spend</th></tr></thead><tbody>${rows}</tbody></table>` : ""}
    <p style="font-size:13px;color:#ff8a8a;line-height:1.6;font-weight:600;margin:0 0 22px 0;">
      Recommended: review API keys in the Anthropic Console, tighten per-key spend limits, and check for runaway agent loops.
    </p>
    <a href="${dashboardUrl}" style="display:block;background:#00ed64;color:#001e2b;text-align:center;padding:13px 24px;border-radius:999px;font-weight:700;font-size:14px;text-decoration:none;">Open usage breakdown</a>
    <hr style="border:0;border-top:1px solid #1c2d38;margin:24px 0;"/>
    <p style="font-size:11px;color:#8fa0ad;line-height:1.5;margin:0;">${sourceNote} Budget alerts are limited to once per calendar month per workspace.</p>
  </div>
</body>
</html>`;
}
