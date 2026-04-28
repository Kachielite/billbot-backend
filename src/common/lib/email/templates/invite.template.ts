import { CONSTANTS } from '@/common/configuration/constants';

export interface InviteEmailData {
  inviterName: string;
  groupName: string;
  inviteLink: string;
  inviteCode: string;
  expiresInDays: number;
}

export function buildInviteEmail(data: InviteEmailData): { subject: string; html: string } {
  const subject = `${data.inviterName} invited you to join ${data.groupName} on BillBot`;
  const logoUrl = `${CONSTANTS.APP_BASE_URL}/logo.png`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f4f0;padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(27,122,72,0.12);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#145939 0%,#1B7A48 50%,#23A05F 100%);padding:44px 48px 36px;text-align:center;">
              <!-- Logo -->
              <img src="${logoUrl}" alt="BillBot" width="72" height="72"
                style="display:block;margin:0 auto 20px;border-radius:18px;box-shadow:0 4px 16px rgba(0,0,0,0.25);" />
              <h1 style="margin:0 0 6px;font-size:30px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">BillBot</h1>
              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.75);font-weight:500;letter-spacing:0.3px;">Split bills. Stay friends.</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:44px 48px 36px;">

              <!-- Greeting -->
              <p style="margin:0 0 28px;font-size:16px;color:#374151;line-height:1.7;">
                You've been invited to join a group on BillBot — the smartest way to track shared expenses and settle up fairly with family and friends.
              </p>

              <!-- Invite Card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                style="background:#f0faf4;border:2px solid #1B7A48;border-radius:14px;margin-bottom:36px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#1B7A48;text-transform:uppercase;letter-spacing:1.5px;">Group Invite</p>
                    <h2 style="margin:0 0 20px;font-size:22px;font-weight:800;color:#145939;">
                      ${data.groupName}
                    </h2>
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-right:12px;">
                          <div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#1B7A48,#23A05F);text-align:center;line-height:38px;font-size:17px;">👤</div>
                        </td>
                        <td>
                          <p style="margin:0 0 2px;font-size:12px;color:#6b7280;">Invited by</p>
                          <p style="margin:0;font-size:15px;font-weight:700;color:#111827;">${data.inviterName}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${data.inviteLink}"
                       style="display:inline-block;background:linear-gradient(135deg,#1B7A48 0%,#23A05F 100%);color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:16px 44px;border-radius:50px;letter-spacing:0.3px;box-shadow:0 4px 20px rgba(27,122,72,0.4);">
                      Accept Invite &amp; Join Group →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Invite Code -->
              <p style="margin:0 0 14px;font-size:13px;color:#6b7280;text-align:center;">
                Already have the app? Enter this code to join directly:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;background:#fffbf0;border:2px dashed #E8920A;border-radius:12px;padding:14px 36px;">
                      <span style="font-size:26px;font-weight:800;letter-spacing:5px;color:#E8920A;">${data.inviteCode}</span>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 36px;font-size:12px;color:#9ca3af;text-align:center;">
                This invite expires in <strong style="color:#374151;">${data.expiresInDays} days</strong>. You'll need a BillBot account to accept it.
              </p>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
                <tr>
                  <td style="border-top:1px solid #e5e7eb;"></td>
                </tr>
              </table>

              <!-- What is BillBot -->
              <h3 style="margin:0 0 20px;font-size:15px;font-weight:700;color:#111827;">What you get with BillBot</h3>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:36px;">
                <tr>
                  <td width="44" valign="top" style="padding-bottom:18px;">
                    <div style="width:36px;height:36px;background:#f0faf4;border-radius:10px;text-align:center;line-height:36px;font-size:18px;">👨‍👩‍👧</div>
                  </td>
                  <td valign="top" style="padding-bottom:18px;padding-left:4px;">
                    <p style="margin:0 0 3px;font-size:14px;font-weight:600;color:#111827;">Track group expenses</p>
                    <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">Log rent, school fees, groceries and any shared cost in one place.</p>
                  </td>
                </tr>
                <tr>
                  <td width="44" valign="top" style="padding-bottom:18px;">
                    <div style="width:36px;height:36px;background:#fff8ed;border-radius:10px;text-align:center;line-height:36px;font-size:18px;">💰</div>
                  </td>
                  <td valign="top" style="padding-bottom:18px;padding-left:4px;">
                    <p style="margin:0 0 3px;font-size:14px;font-weight:600;color:#111827;">See who owes what</p>
                    <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">Smart balances show exactly who needs to pay back — no awkward conversations.</p>
                  </td>
                </tr>
                <tr>
                  <td width="44" valign="top">
                    <div style="width:36px;height:36px;background:#f0faf4;border-radius:10px;text-align:center;line-height:36px;font-size:18px;">✅</div>
                  </td>
                  <td valign="top" style="padding-left:4px;">
                    <p style="margin:0 0 3px;font-size:14px;font-weight:600;color:#111827;">Settle up instantly</p>
                    <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">Record settlements and confirm payments so everyone stays on the same page.</p>
                  </td>
                </tr>
              </table>

              <!-- Download Section -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0faf4;border-radius:14px;border:1px solid #c6e8d4;">
                <tr>
                  <td style="padding:24px 28px;text-align:center;">
                    <p style="margin:0 0 16px;font-size:14px;font-weight:600;color:#1B7A48;">Download the BillBot app</p>
                    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                      <tr>
                        <td style="padding-right:12px;">
                          <a href="https://apps.apple.com/app/billbot"
                             style="display:inline-block;background:#000000;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;border:1px solid #333333;min-width:130px;text-align:left;">
                            <span style="display:block;font-size:10px;font-weight:400;color:#cccccc;line-height:1.2;letter-spacing:0.3px;">Download on the</span>
                            <span style="display:block;font-size:16px;font-weight:700;color:#ffffff;line-height:1.3;letter-spacing:-0.3px;">App Store</span>
                          </a>
                        </td>
                        <td>
                          <a href="https://play.google.com/store/apps/billbot"
                             style="display:inline-block;background:#000000;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;border:1px solid #333333;min-width:130px;text-align:left;">
                            <span style="display:block;font-size:10px;font-weight:400;color:#cccccc;line-height:1.2;letter-spacing:0.3px;">Get it on</span>
                            <span style="display:block;font-size:16px;font-weight:700;color:#ffffff;line-height:1.3;letter-spacing:-0.3px;">Google Play</span>
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
              <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;text-align:center;line-height:1.7;">
                You received this email because someone invited you to join their BillBot group.<br />
                If you didn't expect this, you can safely ignore it.
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
