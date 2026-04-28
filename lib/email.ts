import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.SMTP_FROM ?? 'WashIQ <noreply@washiq.be>';

export async function sendWelcomeEmail(to: string, name: string, password: string) {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Welkom bij WashIQ — uw accountgegevens',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0a0e1a;color:#e8eaf0;border-radius:12px;">
        <h2 style="margin:0 0 8px;font-size:20px;color:#ffffff;">Welkom, ${name}!</h2>
        <p style="margin:0 0 24px;color:#9ca3b0;font-size:14px;">Uw account voor WashIQ is aangemaakt. Hieronder vindt u uw inloggegevens.</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <tr>
            <td style="padding:10px 14px;background:#151929;border-radius:8px 8px 0 0;color:#9ca3b0;font-size:13px;border-bottom:1px solid #1e2438;">E-mail</td>
            <td style="padding:10px 14px;background:#151929;border-radius:8px 8px 0 0;font-size:13px;border-bottom:1px solid #1e2438;">${to}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;background:#151929;border-radius:0 0 8px 8px;color:#9ca3b0;font-size:13px;">Wachtwoord</td>
            <td style="padding:10px 14px;background:#151929;border-radius:0 0 8px 8px;font-size:13px;font-family:monospace;letter-spacing:0.05em;">${password}</td>
          </tr>
        </table>
        <p style="margin:0 0 8px;color:#9ca3b0;font-size:13px;">U kunt uw wachtwoord op elk moment wijzigen via de accountinstellingen.</p>
        <p style="margin:0;color:#9ca3b0;font-size:13px;">Met vriendelijke groeten,<br/>Het WashIQ team</p>
      </div>
    `,
  });
}

export async function sendPasswordChangedEmail(to: string, name: string) {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'WashIQ — uw wachtwoord is gewijzigd',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0a0e1a;color:#e8eaf0;border-radius:12px;">
        <h2 style="margin:0 0 8px;font-size:20px;color:#ffffff;">Wachtwoord gewijzigd</h2>
        <p style="margin:0 0 16px;color:#9ca3b0;font-size:14px;">Hallo ${name},</p>
        <p style="margin:0 0 24px;color:#9ca3b0;font-size:14px;">Het wachtwoord van uw WashIQ account (<strong style="color:#e8eaf0;">${to}</strong>) werd zojuist gewijzigd.</p>
        <p style="margin:0 0 8px;color:#9ca3b0;font-size:13px;">Als u deze wijziging niet zelf heeft aangevraagd, neem dan onmiddellijk contact op met uw beheerder.</p>
        <p style="margin:0;color:#9ca3b0;font-size:13px;">Met vriendelijke groeten,<br/>Het WashIQ team</p>
      </div>
    `,
  });
}
