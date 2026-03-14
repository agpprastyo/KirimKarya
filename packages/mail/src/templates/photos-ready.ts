import { baseTemplate } from "./base";

export const photosReadyTemplate = (galleryTitle: string, dashboardUrl: string) => {
    const content = `
        <h2>Photos processed successfully! ✅</h2>
        <p>All high-resolution photos and secure watermarked previews for your gallery <strong>${galleryTitle}</strong> have finished processing.</p>
        <p>Your assets are safely stored and prepared for client proofing.</p>
        
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center" style="padding: 16px 0 32px 0;">
              <a href="${dashboardUrl}" class="button">Go to Dashboard</a>
            </td>
          </tr>
        </table>
        
        <p style="font-size: 14px; color: #52525b; margin-bottom: 8px;">If the button above doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; margin-top: 0;">
            <a href="${dashboardUrl}" style="color: #2563eb; text-decoration: underline; font-size: 14px;">${dashboardUrl}</a>
        </p>
    `;

    return baseTemplate({
        title: `Photos for "${galleryTitle}" are Ready`,
        preheader: `All photos for your gallery ${galleryTitle} have finished processing and are ready for proofing.`,
        content,
    });
};
