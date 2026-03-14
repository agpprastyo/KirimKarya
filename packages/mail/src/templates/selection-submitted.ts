import { baseTemplate } from "./base";

export const selectionSubmittedTemplate = (galleryTitle: string, selectionCount: number, dashboardUrl: string) => {
    const content = `
        <h2>Final Selection Received 📥</h2>
        <p>Your client has successfully finalized their photo selection for the gallery <strong>${galleryTitle}</strong>.</p>
        
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 32px 0;">
          <tr>
            <td align="center">
              <div style="background-color: #f4f4f5; padding: 24px; border-radius: 12px; display: inline-block; min-width: 200px; border: 1px solid #e4e4e7;">
                  <span style="display: block; font-size: 13px; color: #71717a; text-transform: uppercase; font-weight: 700; letter-spacing: 0.1em; margin-bottom: 8px;">Total Items Selected</span>
                  <span style="display: block; font-size: 42px; font-weight: 800; color: #18181b; line-height: 1;">${selectionCount}</span>
              </div>
            </td>
          </tr>
        </table>
        
        <p>You can now review their selection securely from your studio dashboard and proceed to the delivery phase.</p>
        
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center" style="padding: 16px 0 32px 0;">
              <a href="${dashboardUrl}" class="button">View Selection Details</a>
            </td>
          </tr>
        </table>
        
        <p style="font-size: 14px; color: #52525b; margin-bottom: 8px;">If the button above doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; margin-top: 0;">
            <a href="${dashboardUrl}" style="color: #2563eb; text-decoration: underline; font-size: 14px;">${dashboardUrl}</a>
        </p>
    `;

    return baseTemplate({
        title: `New Client Selection for "${galleryTitle}"`,
        preheader: `Your client has finalized their photo selection for ${galleryTitle}. Total items: ${selectionCount}.`,
        content,
    });
};
