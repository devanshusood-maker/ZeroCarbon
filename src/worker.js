import { EmailMessage } from "cloudflare:email";

const TO_ADDRESS = "info@zero-carbon.earth";
const FROM_ADDRESS = "noreply@zero-carbon.earth";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/contact" && request.method === "POST") {
      return handleContact(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleContact(request, env) {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: cors,
    });
  }

  const name = sanitize(body.name);
  const email = sanitize(body.email);
  const company = sanitize(body.company);
  const interest = sanitize(body.interest);
  const message = (body.message || "").toString().trim();

  if (!name || !email || !isValidEmail(email)) {
    return new Response(JSON.stringify({ error: "Please provide a valid name and email." }), {
      status: 400,
      headers: cors,
    });
  }

  const subject = `New contact form submission from ${name}`;
  const lines = [
    `Name: ${name}`,
    `Email: ${email}`,
    `Company: ${company || "-"}`,
    `Area of Interest: ${interest || "-"}`,
    "",
    "Message:",
    message || "-",
  ].join("\n");

  const raw = buildRawEmail({
    from: FROM_ADDRESS,
    to: TO_ADDRESS,
    replyTo: email,
    subject,
    body: lines,
  });

  try {
    const message = new EmailMessage(FROM_ADDRESS, TO_ADDRESS, raw);
    await env.SEND_EMAIL.send(message);
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to send message. Please try again later." }), {
      status: 502,
      headers: cors,
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: cors,
  });
}

function sanitize(value) {
  return (value || "").toString().replace(/[\r\n]+/g, " ").trim().slice(0, 500);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildRawEmail({ from, to, replyTo, subject, body }) {
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const encodedBody = btoa(unescape(encodeURIComponent(body)));

  return [
    `From: Zero Carbon Website <${from}>`,
    `To: ${to}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodedBody,
  ].join("\r\n");
}
