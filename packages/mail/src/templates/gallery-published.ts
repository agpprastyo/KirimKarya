import { baseTemplate } from "./base";

export const galleryPublishedTemplate = (galleryTitle: string, galleryUrl: string) => {
    const content = `
        <h2>Your gallery is ready! 🎉</h2>
        <p>Great news! The gallery <strong>${galleryTitle}</strong> has been successfully published and is now ready for viewing. You can start exploring, proofing, and selecting your favorite photos right away.</p>
        
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center" style="padding: 16px 0 32px 0;">
              <a href="${galleryUrl}" class="button">View Gallery</a>
            </td>
          </tr>
        </table>
        
        <p style="font-size: 14px; color: #52525b; margin-bottom: 8px;">If the button above doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; margin-top: 0;">
            <a href="${galleryUrl}" style="color: #2563eb; text-decoration: underline; font-size: 14px;">${galleryUrl}</a>
        </p>
    `;

    return baseTemplate({
        title: `Your Gallery "${galleryTitle}" is Published!`,
        preheader: `Great news! The gallery ${galleryTitle} has been successfully published and is now ready for viewing.`,
        content,
    });
};
