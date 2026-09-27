import { GoogleAuthProvider, signInWithPopup, User } from "firebase/auth";
import { auth, googleProvider } from "../firebase";

export const GMAIL_SCOPES = [
  "https://mail.google.com/",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/gmail.metadata",
];

// In-memory token caching per workspace integration skill guidelines.
// Never persist in localStorage or sessionStorage.
let inMemoryAccessToken: string | null = null;
let isAuthenticating = false;

export const setGmailAccessToken = (token: string | null) => {
  inMemoryAccessToken = token;
};

export const getGmailAccessToken = (): string | null => {
  return inMemoryAccessToken;
};

export const isGmailConnected = (): boolean => {
  return Boolean(inMemoryAccessToken);
};

export const clearGmailAccessToken = () => {
  inMemoryAccessToken = null;
};

/**
 * Connect or sign in with Google requesting all Gmail scopes.
 * Caches the resulting OAuth access token in-memory.
 */
export const connectGmailAccount = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (isAuthenticating) return null;
  isAuthenticating = true;
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Unable to retrieve Google OAuth access token.");
    }
    inMemoryAccessToken = credential.accessToken;
    return {
      user: result.user,
      accessToken: credential.accessToken,
    };
  } catch (err: any) {
    if (
      err?.code === "auth/cancelled-popup-request" ||
      err?.code === "auth/popup-closed-by-user" ||
      err?.message?.includes("cancelled-popup-request") ||
      err?.message?.includes("popup-closed-by-user")
    ) {
      return null;
    }
    console.error("Gmail authorization error:", err);
    throw err;
  } finally {
    isAuthenticating = false;
  }
};

export interface GmailUserProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  snippet: string;
  sender: string;
  recipient: string;
  subject: string;
  date: string;
  labels: string[];
  unread: boolean;
  bodySnippet?: string;
}

export interface SendEmailPayload {
  to: string;
  subject: string;
  htmlBody: string;
}

/**
 * Fetch Gmail user profile (email address and mail counts)
 */
export async function getGmailProfile(accessToken: string): Promise<GmailUserProfile> {
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gmail API Profile error (${res.status}): ${errText}`);
  }

  return await res.json();
}

/**
 * List recent messages matching query
 */
export async function listGmailMessages(
  accessToken: string,
  options: { query?: string; maxResults?: number; labelIds?: string[] } = {}
): Promise<GmailMessageSummary[]> {
  const { query = "", maxResults = 15, labelIds = [] } = options;

  const params = new URLSearchParams();
  params.set("maxResults", Math.min(maxResults, 25).toString());
  if (query) params.set("q", query);
  labelIds.forEach((l) => params.append("labelIds", l));

  const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!listRes.ok) {
    const err = await listRes.text();
    throw new Error(`Failed to list Gmail messages (${listRes.status}): ${err}`);
  }

  const listData = await listRes.json();
  const rawMessages: { id: string; threadId: string }[] = listData.messages || [];

  if (rawMessages.length === 0) {
    return [];
  }

  // Fetch headers & snippet for each message in parallel
  const details = await Promise.all(
    rawMessages.map(async (msg) => {
      try {
        const itemRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/json",
            },
          }
        );
        if (!itemRes.ok) return null;
        const data = await itemRes.json();
        const headers: { name: string; value: string }[] = data.payload?.headers || [];

        const getHeader = (name: string) => {
          const h = headers.find((header) => header.name.toLowerCase() === name.toLowerCase());
          return h ? h.value : "";
        };

        const labels: string[] = data.labelIds || [];
        const unread = labels.includes("UNREAD");

        const summary: GmailMessageSummary = {
          id: data.id,
          threadId: data.threadId,
          snippet: data.snippet ? decodeHtmlEntities(data.snippet) : "",
          sender: getHeader("From"),
          recipient: getHeader("To"),
          subject: getHeader("Subject") || "(No Subject)",
          date: getHeader("Date"),
          labels,
          unread,
        };
        return summary;
      } catch (err) {
        console.warn(`Failed to fetch message details for ${msg.id}:`, err);
        return null;
      }
    })
  );

  return details.filter((item): item is GmailMessageSummary => item !== null);
}

/**
 * Fetch full body content for a specific message
 */
export async function getGmailMessageContent(accessToken: string, messageId: string): Promise<string> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to load email message (${res.status})`);
  }

  const data = await res.json();
  return extractMessageBody(data.payload);
}

function extractMessageBody(payload: any): string {
  if (!payload) return "";

  if (payload.body && payload.body.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.parts && Array.isArray(payload.parts)) {
    // Prefer HTML part first, then plain text
    const htmlPart = payload.parts.find((p: any) => p.mimeType === "text/html" && p.body?.data);
    if (htmlPart) return decodeBase64Url(htmlPart.body.data);

    const textPart = payload.parts.find((p: any) => p.mimeType === "text/plain" && p.body?.data);
    if (textPart) {
      const text = decodeBase64Url(textPart.body.data);
      return `<pre style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(text)}</pre>`;
    }

    // Recursively check nested parts
    for (const part of payload.parts) {
      const nested = extractMessageBody(part);
      if (nested) return nested;
    }
  }

  return "";
}

/**
 * Send an email directly via the official Gmail API
 */
export async function sendGmailEmail(
  accessToken: string,
  senderEmail: string,
  payload: SendEmailPayload
): Promise<{ id: string; threadId: string }> {
  const rawRFC2822 = createRFC2822Message(senderEmail, payload.to, payload.subject, payload.htmlBody);

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      raw: rawRFC2822,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gmail API send failed (${res.status}): ${errorText}`);
  }

  return await res.json();
}

/**
 * Trash an email in Gmail
 */
export async function trashGmailMessage(accessToken: string, messageId: string): Promise<boolean> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return res.ok;
}

// Helpers
function createRFC2822Message(from: string, to: string, subject: string, htmlContent: string): string {
  // UTF-8 compliant Subject header encoding
  const encodedSubject = `=?UTF-8?B?${utf8ToBase64(subject)}?=`;

  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    utf8ToBase64(htmlContent),
  ];

  const fullStr = lines.join("\r\n");
  return toBase64Url(fullStr);
}

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function toBase64Url(base64Str: string): string {
  return btoa(unescape(encodeURIComponent(base64Str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodeBase64Url(input: string): string {
  try {
    let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch (e) {
    return input;
  }
}

function decodeHtmlEntities(str: string): string {
  const txt = document.createElement("textarea");
  txt.innerHTML = str;
  return txt.value;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
