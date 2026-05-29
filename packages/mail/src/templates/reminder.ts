import { baseTemplate } from "./base";

export const reminderTemplate = (galleryTitle: string, customMessage: string, galleryUrl: string) => {
    const content = `
        <h2>Friendly Reminder 📸</h2>
        <p>A message from your photographer regarding your gallery <strong>${galleryTitle}</strong>:</p>
        
        <div style="background-color: #fafafa; border-left: 4px solid #18181b; padding: 16px 20px; border-radius: 8px; margin: 24px 0; font-style: italic; color: #18181b;">
            "${customMessage}"
        </div>
        
        <p>Please click the button below to log in and access your gallery to review and complete your selections.</p>
        
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center" style="padding: 16px 0 32px 0;">
              <a href="${galleryUrl}" class="button">Access Gallery</a>
            </td>
          </tr>
        </table>
        
        <p style="font-size: 14px; color: #52525b; margin-bottom: 8px;">If the button above doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; margin-top: 0;">
            <a href="${galleryUrl}" style="color: #2563eb; text-decoration: underline; font-size: 14px;">${galleryUrl}</a>
        </p>
    `;

    return baseTemplate({
        title: `Reminder: ${galleryTitle}`,
        preheader: `Friendly reminder regarding your gallery selection: "${customMessage}"`,
        content,
    });
};
