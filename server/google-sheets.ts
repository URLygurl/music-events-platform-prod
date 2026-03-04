/**
 * Google Sheets Integration — portable replacement for the Replit connector.
 *
 * Uses a Google Service Account (JSON key) stored in the GOOGLE_SERVICE_ACCOUNT_JSON
 * environment variable. If the env var is not set, all sheet operations silently
 * no-op so the rest of the app keeps working without Google Sheets configured.
 *
 * To set up:
 *  1. Create a Service Account in Google Cloud Console
 *  2. Give it Editor access to the target Google Sheet
 *  3. Download the JSON key and set GOOGLE_SERVICE_ACCOUNT_JSON=<contents>
 */

import { google } from "googleapis";

function getClient() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) return null;
  try {
    const credentials = JSON.parse(json);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    return google.sheets({ version: "v4", auth });
  } catch (err) {
    console.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:", err);
    return null;
  }
}

export async function isGoogleSheetsConnected(): Promise<boolean> {
  return !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
}

export async function appendToSheet(
  spreadsheetId: string,
  sheetName: string,
  values: string[][],
): Promise<void> {
  const sheets = getClient();
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
