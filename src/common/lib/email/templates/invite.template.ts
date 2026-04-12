export interface InviteEmailData {
  inviterName: string;
  groupName: string;
  inviteLink: string;
  expiresInDays: number;
}

export function buildInviteEmail(data: InviteEmailData): { subject: string; html: string } {
  const subject = `${data.inviterName} invited you to join ${data.groupName} on BillBot`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f4f8;padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6c47ff 0%,#4f8ef7 100%);padding:40px 48px;text-align:center;">
              <div style="font-size:40px;margin-bottom:12px;">💸</div>
              <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">BillBot</h1>
              <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.8);font-weight:500;">Split bills. Stay friends.</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:48px 48px 32px;">

              <!-- Greeting -->
              <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6;">
                You've been invited to join a group on BillBot — the smartest way for families and friends to track shared expenses and settle up fairly.
              </p>

              <!-- Invite Card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f7ff;border:2px solid #e8e4ff;border-radius:12px;margin-bottom:32px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#6c47ff;text-transform:uppercase;letter-spacing:1px;">Group Invite</p>
                    <h2 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#1a1a2e;">
                      🎉 ${data.groupName}
                    </h2>
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-right:10px;">
                          <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#6c47ff,#4f8ef7);display:inline-flex;align-items:center;justify-content:center;font-size:16px;text-align:center;line-height:36px;">👤</div>
                        </td>
                        <td>
                          <p style="margin:0;font-size:14px;color:#6b7280;">Invited by</p>
                          <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">${data.inviterName}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- What is BillBot -->
              <h3 style="margin:0 0 16px;font-size:16px;font-weight:700;color:#111827;">What is BillBot?</h3>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
                <tr>
                  <td width="40" valign="top" style="padding-right:12px;padding-bottom:16px;">
                    <div style="font-size:22px;">👨‍👩‍👧</div>
                  </td>
                  <td valign="top" style="padding-bottom:16px;">
                    <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">Track family & group expenses</p>
                    <p style="margin:4px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">Log rent, school fees, groceries and any shared cost in one place.</p>
                  </td>
                </tr>
                <tr>
                  <td width="40" valign="top" style="padding-right:12px;padding-bottom:16px;">
                    <div style="font-size:22px;">💰</div>
                  </td>
                  <td valign="top" style="padding-bottom:16px;">
                    <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">See who owes what</p>
                    <p style="margin:4px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">Smart balances show exactly who needs to pay back — no awkward conversations.</p>
                  </td>
                </tr>
                <tr>
                  <td width="40" valign="top" style="padding-right:12px;">
                    <div style="font-size:22px;">✅</div>
                  </td>
                  <td valign="top">
                    <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">Settle up instantly</p>
                    <p style="margin:4px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">Record settlements and confirm payments so everyone stays on the same page.</p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="${data.inviteLink}"
                       style="display:inline-block;background:linear-gradient(135deg,#6c47ff 0%,#4f8ef7 100%);color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:16px 40px;border-radius:50px;letter-spacing:0.3px;box-shadow:0 4px 16px rgba(108,71,255,0.4);">
                      Accept Invite &amp; Join Group →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 32px;font-size:12px;color:#9ca3af;text-align:center;">
                This invite expires in <strong>${data.expiresInDays} days</strong>. You'll need to create a BillBot account to accept it.
              </p>

              <!-- Download Section -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb;border-radius:12px;margin-bottom:0;">
                <tr>
                  <td style="padding:24px 28px;text-align:center;">
                    <p style="margin:0 0 16px;font-size:14px;font-weight:600;color:#374151;">Download the BillBot app</p>
                    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                      <tr>
                        <td style="padding-right:12px;">
                          <a href="https://apps.apple.com/app/billbot" style="display:inline-block;background:#000000;color:#ffffff;text-decoration:none;font-size:12px;font-weight:600;padding:10px 20px;border-radius:8px;">
                            🍎 App Store
                          </a>
                        </td>
                        <td>
                          <a href="https://play.google.com/store/apps/billbot" style="display:inline-block;background:#01875f;color:#ffffff;text-decoration:none;font-size:12px;font-weight:600;padding:10px 20px;border-radius:8px;">
                            ▶ Google Play
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:24px 48px;border-top:1px solid #e5e7eb;">
              <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
                You received this email because someone invited you to join their BillBot group.<br />
                If you didn't expect this, you can safely ignore this email.
              </p>
              <p style="margin:0;font-size:12px;color:#d1d5db;text-align:center;">
                &copy; ${new Date().getFullYear()} BillBot. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>`;

  return { subject, html };
}
