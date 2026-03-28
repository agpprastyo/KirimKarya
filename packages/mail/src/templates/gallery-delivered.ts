import { baseTemplate } from "./base";

export const galleryDeliveredTemplate = (galleryTitle: string, downloadUrl: string) => {
    const content = `
        <h2>Your photos are ready for download! 📦</h2>
        <p>Excellent news! The final selection for <strong>${galleryTitle}</strong> has been packaged and is now ready for high-resolution download.</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin: 24px 0; text-align: center;">
            <p style="margin-top: 0; font-weight: 600; color: #1e293b;">Click the button below to download your collection:</p>
            <a href="${downloadUrl}" class="button" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">Download ZIP File</a>
            <p style="margin-bottom: 0; font-size: 12px; color: #64748b; margin-top: 16px;">This link will expire in 7 days for security purposes.</p>
        </div>
        
        <p style="font-size: 14px; color: #52525b; margin-bottom: 8px;">If the button above doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; margin-top: 0;">
            <a href="${downloadUrl}" style="color: #2563eb; text-decoration: underline; font-size: 14px;">${downloadUrl}</a>
        </p>
        
        <p>Thank you for using Kirim Karya!</p>
    `;

    return baseTemplate({
        title: `Your Photos from "${galleryTitle}" are Ready!`,
        preheader: `Excellent news! The final selection for ${galleryTitle} has been packaged and is now ready for high-resolution download.`,
        content,
    });
};
