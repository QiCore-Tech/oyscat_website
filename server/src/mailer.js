import nodemailer from "nodemailer"

export function createMailer(smtp) {
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465, // implicit TLS on 465, STARTTLS otherwise
    auth: { user: smtp.user, pass: smtp.pass },
    connectionTimeout: smtp.timeoutMs,
    greetingTimeout: smtp.timeoutMs,
    socketTimeout: smtp.timeoutMs,
  })

  return {
    async send({ to, subject, text, replyTo }) {
      await transport.sendMail({ from: smtp.user, to, subject, text, replyTo })
    },
  }
}
