import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { Staff } from "../models/Staff.js";
import { buildPropertyEnquiryEmail } from "../templates/propertyEnquiryEmail.js";

let transporter;

function smtpConfigured() {
  return Boolean(env.smtp.host && env.smtp.port && env.smtp.user && env.smtp.appPassword);
}

function getTransporter() {
  transporter ||= nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    auth: {
      user: env.smtp.user,
      pass: env.smtp.appPassword,
    },
  });
  return transporter;
}

function safeFailureReason(error) {
  const code = error?.code || error?.command || error?.responseCode || "smtp_error";
  return String(code).slice(0, 80);
}

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

async function resolvePropertyRecipient(property = {}) {
  const primaryId = property.assignedTo || property.assignedSupervisor || property.createdBy;
  if (!primaryId) return null;
  return Staff.findById(primaryId).select("name email role phone whatsapp designation companyName").lean();
}

export async function sendPropertyEnquiryEmail({ property, enquiry }) {
  const attemptedAt = new Date();
  const supervisor = await resolvePropertyRecipient(property);
  const fallbackEmail = env.smtp.fallbackRecipient || env.smtp.user;
  const supervisorEmail = supervisor?.email || "";
  const to = supervisorEmail || fallbackEmail;
  const fallbackUsed = Boolean(!supervisorEmail && fallbackEmail);
  const recipientStaffId = supervisor?._id || property?.assignedTo || property?.createdBy || null;

  if (!to) {
    console.warn(`[Email] Property enquiry notification skipped; no supervisor or fallback email for enquiry ${enquiry?._id}`);
    return {
      status: "skipped",
      attemptedAt,
      recipientStaffId,
      fallbackUsed,
      failureReason: "recipient_missing",
    };
  }

  if (!smtpConfigured()) {
    console.warn(`[Email] Property enquiry notification skipped; SMTP is not configured for enquiry ${enquiry?._id}`);
    return {
      status: "skipped",
      attemptedAt,
      recipientStaffId,
      fallbackUsed,
      failureReason: "smtp_not_configured",
    };
  }

  const email = buildPropertyEnquiryEmail({
    supervisor: supervisor || { name: "Akshar Estate Team", email: to },
    property,
    enquiry,
    siteOrigin: env.siteOrigin,
  });
  const officialEmail = normalizeEmail(env.smtp.fallbackRecipient || env.smtp.user);
  const recipientEmail = normalizeEmail(to);
  const bcc = officialEmail && officialEmail !== recipientEmail ? officialEmail : undefined;

  try {
    await getTransporter().sendMail({
      from: `"${env.smtp.fromName}" <${env.smtp.user}>`,
      to,
      bcc,
      subject: email.subject,
      html: email.html,
      text: email.text,
      replyTo: enquiry?.email || undefined,
    });
    console.log(`[Email] Property enquiry notification sent to supervisor: ${recipientStaffId || "fallback"}`);
    return {
      status: "sent",
      attemptedAt,
      sentAt: new Date(),
      recipientStaffId,
      fallbackUsed,
      failureReason: "",
    };
  } catch (error) {
    console.warn(`[Email] Property enquiry notification failed for enquiry ${enquiry?._id}: ${safeFailureReason(error)}`);
    return {
      status: "failed",
      attemptedAt,
      recipientStaffId,
      fallbackUsed,
      failureReason: safeFailureReason(error),
    };
  }
}
