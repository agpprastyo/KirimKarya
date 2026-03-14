interface BaseTemplateProps {
    title: string;
    preheader: string;
    content: string;
}

export const baseTemplate = ({ title, preheader, content }: BaseTemplateProps) => `
<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="x-apple-disable-message-reformatting">
  <meta http-equiv="x-ua-compatible" content="ie=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>${title}</title>
  <style>
    body, table, td { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; }
    body { background-color: #f4f4f5; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; width: 100% !important; }
    .container { max-width: 600px; margin: 0 auto; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; margin-top: 40px; margin-bottom: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
    .header { background-color: #18181b; padding: 32px 40px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.025em; }
    .content { padding: 40px; color: #3f3f46; font-size: 16px; line-height: 1.6; }
    .content h2 { color: #18181b; font-size: 22px; font-weight: 700; margin-top: 0; margin-bottom: 24px; letter-spacing: -0.025em; }
    .content p { margin-top: 0; margin-bottom: 24px; }
    .button { display: inline-block; background-color: #18181b; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; margin-bottom: 24px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); transition: background-color 0.2s ease; }
    .button:hover { background-color: #27272a; }
    .footer { background-color: #fafafa; padding: 32px 40px; text-align: center; color: #a1a1aa; font-size: 14px; border-top: 1px solid #e4e4e7; }
    .footer p { margin: 0 0 8px 0; }
    .footer p:last-child { margin-bottom: 0; }
    
    @media screen and (max-width: 600px) {
      .container { margin-top: 0; margin-bottom: 0; border-radius: 0; width: 100% !important; box-shadow: none; }
      .content { padding: 32px 24px; }
      .header { padding: 32px 24px; }
      .footer { padding: 32px 24px; }
    }
  </style>
</head>
<body>
  <div style="display: none; font-size: 1px; color: #f4f4f5; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${preheader}
  </div>
  <table border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center" style="background-color: #f4f4f5; padding: 20px 0;">
        <table border="0" cellpadding="0" cellspacing="0" class="container">
          <tr>
            <td class="header">
              <h1>Kirim Karya</h1>
            </td>
          </tr>
          <tr>
            <td class="content">
              ${content}
            </td>
          </tr>
          <tr>
            <td class="footer">
              <p>&copy; ${new Date().getFullYear()} Kirim Karya. All rights reserved.</p>
              <p>Designed for professional studios & clients.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
