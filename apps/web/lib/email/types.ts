export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type EmailProviderName = "console" | "resend";

export type SendEmailResult = {
  provider: EmailProviderName;
  /** Provider message id. Null for the console transport. */
  id: string | null;
};

export type EmailEnv = {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  CI?: string;
  EMAIL_PROVIDER?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
};
