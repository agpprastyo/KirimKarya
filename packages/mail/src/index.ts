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

export const sendEmail = async ({ to, subject, html }: { to: string, subject: string, html: string }) => {
    return transporter.sendMail({
        from: '"Kirim Karya" <no-reply@kirimkarya.com>',
        to,
        subject,
        html,
    });
};
