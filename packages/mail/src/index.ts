import nodemailer from "nodemailer";
import { env } from "./env";

const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
    },
});

import { 
    galleryPublishedTemplate, 
    photosReadyTemplate, 
    selectionSubmittedTemplate,
    otpTemplate,
    galleryDeliveredTemplate
} from "./templates";

export const sendEmail = async ({ to, subject, html }: { to: string, subject: string, html: string }) => {
    return transporter.sendMail({
        from: '"Kirim Karya" <no-reply@kirimkarya.com>',
        to,
        subject,
        html,
    });
};

export const sendOTPEmail = async (to: string, code: string, galleryTitle: string) => {
    return sendEmail({
        to,
        subject: "Your Verification Code",
        html: otpTemplate(code, galleryTitle),
    });
};

export const sendGalleryPublishedEmail = async (to: string, galleryTitle: string, galleryUrl: string) => {
    return sendEmail({
        to,
        subject: `Your Gallery "${galleryTitle}" is Published!`,
        html: galleryPublishedTemplate(galleryTitle, galleryUrl),
    });
};

export const sendPhotosReadyEmail = async (to: string, galleryTitle: string, dashboardUrl: string) => {
    return sendEmail({
        to,
        subject: `Photos for "${galleryTitle}" are Ready`,
        html: photosReadyTemplate(galleryTitle, dashboardUrl),
    });
};

export const sendSelectionSubmittedEmail = async (to: string, galleryTitle: string, selectionCount: number, dashboardUrl: string) => {
    return sendEmail({
        to,
        subject: `New Client Selection for "${galleryTitle}"`,
        html: selectionSubmittedTemplate(galleryTitle, selectionCount, dashboardUrl),
    });
};

export const sendGalleryDeliveredEmail = async (to: string, galleryTitle: string, downloadUrl: string) => {
    return sendEmail({
        to,
        subject: `Your Photos from "${galleryTitle}" are Ready!`,
        html: galleryDeliveredTemplate(galleryTitle, downloadUrl),
    });
};
