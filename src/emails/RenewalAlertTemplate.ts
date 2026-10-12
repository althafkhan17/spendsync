export function renderRenewalAlertEmail({
  adminName,
  workspaceName,
  merchantName,
  amountLabel,
  billingCycle,
  renewalDate,
  daysAhead,
  seats,
  dashboardUrl,
}: {
  adminName: string;
  workspaceName: string;
  merchantName: string;
  amountLabel: string;
  billingCycle: "MONTHLY" | "ANNUAL";
  renewalDate: Date;
  daysAhead: number;
  seats: number | null;
  dashboardUrl: string;
}): string {
  const dateLabel = new Date(renewalDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const cycle = billingCycle === "ANNUAL" ? "annual" : "monthly";
  const seatLine = seats && seats > 0 ? `<li style="margin-bottom:6px;">Billed seats on the last invoice: <strong>${seats}</strong></li>` : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Upcoming renewal: ${merchantName}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f4f7f6;padding:40px 20px;color:#001e2b;margin:0;line-height:1.6;">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e1e5e8;border-top:6px solid #00ed64;padding:36px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#5c6c7a;text-transform:uppercase;margin-bottom:20px;">SpendSync Renewal Radar</div>
    <h1 style="font-size:20px;font-weight:800;margin:0 0 14px 0;letter-spacing:-.01em;">${merchantName} renews in ${daysAhead} day${daysAhead === 1 ? "" : "s"}</h1>
    <p style="font-size:14.5px;color:#3d4f5b;margin:0 0 22px 0;">
      Hi ${adminName},<br/><br/>
      Your ${cycle} subscription for <strong>${merchantName}</strong> in the <strong>${workspaceName}</strong> workspace will auto-renew on <strong>${dateLabel}</strong>.
    </p>
    <div style="background:#e3fcef;border:1px solid #c3f0d2;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
      <div style="font-size:30px;font-weight:800;color:#00684a;letter-spacing:-.02em;">${amountLabel}</div>
      <div style="font-size:12px;color:#00684a;font-weight:600;margin-top:4px;">charged ${cycle} on renewal</div>
    </div>
    <h3 style="font-size:12px;font-weight:700;color:#3d4f5b;text-transform:uppercase;letter-spacing:.05em;margin:0 0 10px 0;">Before it renews</h3>
    <ul style="margin:0 0 22px 0;padding-left:20px;font-size:13.5px;color:#3d4f5b;">
      <li style="margin-bottom:6px;">Confirm the team still uses ${merchantName} day to day.</li>
      ${seatLine}
      <li style="margin-bottom:6px;">Downgrade or remove idle seats before the invoice is generated.</li>
      <li style="margin-bottom:6px;">If the tool is no longer needed, cancel today to avoid the charge.</li>
    </ul>
    <a href="${dashboardUrl}" style="display:block;background:#001e2b;color:#ffffff;text-align:center;padding:14px 24px;border-radius:999px;font-weight:700;font-size:14px;text-decoration:none;">Review in SpendSync</a>
    <div style="text-align:center;font-size:12px;color:#7c8c9a;margin-top:26px;border-top:1px solid #eceff1;padding-top:20px;">
      Automated renewal reminder from SpendSync. Alerts are sent ${daysAhead} days before each renewal.
    </div>
  </div>
</body>
</html>`;
}
