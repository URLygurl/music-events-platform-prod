/**
 * Google Sheets Integration
 *
 * Reads the Google Service Account JSON from:
 *  1. The `google_service_account_json` site setting in the database (set via the admin integrations panel)
 *  2. Falls back to the GOOGLE_SERVICE_ACCOUNT_JSON environment variable
 *
 * If neither is set, all sheet operations silently no-op so the rest of the app keeps working.
 */

import { google } from "googleapis";
import { db } from "./db";
import { siteSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

async function getServiceAccountJson(): Promise<string | null> {
  // 1. Try database first
  try {
    const [setting] = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.key, "google_service_account_json"));
    if (setting?.value && setting.value.trim().length > 10) {
      return setting.value;
    }
  } catch {
    // DB not available yet — fall through to env var
  }
  // 2. Fall back to env var
  return process.env.GOOGLE_SERVICE_ACCOUNT_JSON || null;
}

async function getClient() {
  const json = await getServiceAccountJson();
  if (!json) return null;
  try {
    const credentials = JSON.parse(json);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    return google.sheets({ version: "v4", auth });
  } catch (err) {
    console.error("Failed to parse Google Service Account JSON:", err);
    return null;
  }
}

export async function isGoogleSheetsConnected(): Promise<boolean> {
  const json = await getServiceAccountJson();
  if (!json) return false;
  try {
    JSON.parse(json);
    return true;
  } catch {
    return false;
  }
}

export async function testGoogleSheetsConnection(): Promise<{ ok: boolean; email?: string; error?: string }> {
  const json = await getServiceAccountJson();
  if (!json) return { ok: false, error: "No service account configured" };
  try {
    const credentials = JSON.parse(json);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    // Just getting the auth client verifies the credentials are valid
    await auth.getClient();
    return { ok: true, email: credentials.client_email };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Invalid service account JSON" };
  }
}

export async function appendToSheet(
  spreadsheetId: string,
  sheetName: string,
  values: string[][],
): Promise<void> {
  const sheets = await getClient();
  if (!sheets) {
    console.warn("Google Sheets not configured — skipping sheet append");
    return;
  }
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });
  } catch (err) {
    console.error("Failed to append to Google Sheet:", err);
  }
}
