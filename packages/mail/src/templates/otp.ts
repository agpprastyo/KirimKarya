import { baseTemplate } from "./base";

export const otpTemplate = (code: string, galleryTitle: string) => {
    const content = `
        <h2 style="margin-bottom: 24px;">Security Verification 🔒</h2>
        <p>You requested access to the gallery <strong>${galleryTitle}</strong>. Please use the following verification code to proceed:</p>
        
        <div style="background-color: #f4f4f5; border-radius: 16px; padding: 32px; margin: 32px 0; text-align: center;">
          <span style="font-family: monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #18181b;">${code}</span>
        </div>
        
        <p style="font-size: 14px; color: #71717a;">This code will expire in <strong>5 minutes</strong>. If you did not request this code, please ignore this email.</p>
    `;

    return baseTemplate({
        title: "Your Verification Code",
        preheader: `Your verification code for ${galleryTitle} is ${code}`,
        content,
    });
};
