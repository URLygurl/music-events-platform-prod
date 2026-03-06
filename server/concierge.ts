/**
 * AI Festival Concierge Backend
 * Handles the floating chat widget with context injection, skills, URL fetching,
 * artist/event data awareness, trivia generation, and admin extras.
 */

import { storage } from "./storage";

interface ConciergeSettings {
  enabled: boolean;
  publicAccess: boolean;
  name: string;
  provider: string;
  apiKey: string;
  model: string;
  triviaFrequencyMins: number;
  topicUrl1: string;
  topicUrl2: string;
  topicUrl3: string;
  skill1Name: string;
  skill1Content: string;
  skill2Name: string;
  skill2Content: string;
  skill3Name: string;
  skill3Content: string;
}

export async function getConciergeSettings(): Promise<ConciergeSettings> {
  const get = async (key: string, fallback = "") => {
    const s = await storage.getSetting(key);
    return s?.value ?? fallback;
  };
  return {
    enabled: (await get("concierge_enabled", "false")) === "true",
    publicAccess: (await get("concierge_public_access", "false")) === "true",
    name: await get("concierge_name", ""),
    provider: await get("concierge_provider", "openai"),
    apiKey: await get("concierge_api_key", ""),
    model: await get("concierge_model", "gpt-4o-mini"),
    triviaFrequencyMins: parseInt(await get("concierge_trivia_frequency_mins", "60")),
    topicUrl1: await get("concierge_topic_url_1", ""),
    topicUrl2: await get("concierge_topic_url_2", ""),
    topicUrl3: await get("concierge_topic_url_3", ""),
    skill1Name: await get("concierge_skill_1_name", ""),
    skill1Content: await get("concierge_skill_1_content", ""),
    skill2Name: await get("concierge_skill_2_name", ""),
    skill2Content: await get("concierge_skill_2_content", ""),
    skill3Name: await get("concierge_skill_3_name", ""),
    skill3Content: await get("concierge_skill_3_content", ""),
  };
}

async function fetchUrlContext(url: string): Promise<string> {
  if (!url) return "";
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FestivalConcierge/1.0)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return "";
    const text = await resp.text();
    // Strip HTML tags and trim to 2000 chars to keep context manageable
    const stripped = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    return stripped.slice(0, 2000);
  } catch {
    return "";
  }
}

export async function buildSystemPrompt(isAdmin: boolean): Promise<string> {
  const settings = await getConciergeSettings();

  // Fetch artist and event data from DB
  const [artists, events] = await Promise.all([
    storage.getArtists(),
    storage.getEvents(),
  ]);

  const artistList = artists
    .map((a) => `- ${a.name} (${a.genre || "Unknown genre"})${a.bio ? `: ${a.bio.slice(0, 200)}` : ""}`)
    .join("\n");

  const eventList = events
    .map((e) => `- ${e.name}${e.date ? ` on ${e.date}` : ""}${e.venue ? ` at ${e.venue}` : ""}${e.description ? `: ${e.description.slice(0, 150)}` : ""}`)
    .join("\n");

  // Fetch context from topic URLs in parallel
  const [ctx1, ctx2, ctx3] = await Promise.all([
    fetchUrlContext(settings.topicUrl1),
    fetchUrlContext(settings.topicUrl2),
    fetchUrlContext(settings.topicUrl3),
  ]);

  const concierge_name = settings.name || "your festival concierge";

  let prompt = `You are ${concierge_name}, an AI assistant for this music festival/event platform.

## Your Core Personality
You are a passionate music buff with encyclopedic knowledge of bands, albums, music history, and artists across all genres. You love dropping interesting trivia and facts about musicians. You are also a helpful local guide who knows the venue, logistics, and local area well.

## Artists Playing
${artistList || "No artists listed yet."}

## Events
${eventList || "No events listed yet."}
`;

  // Add topic URL context
  const contexts = [
    { name: settings.topicUrl1, content: ctx1 },
    { name: settings.topicUrl2, content: ctx2 },
    { name: settings.topicUrl3, content: ctx3 },
  ].filter((c) => c.content);

  if (contexts.length > 0) {
    prompt += `\n## Additional Context\n`;
    contexts.forEach((c, i) => {
      prompt += `\n### Source ${i + 1} (${c.name})\n${c.content}\n`;
    });
  }

  // Add skills
  const skills = [
    { name: settings.skill1Name, content: settings.skill1Content },
    { name: settings.skill2Name, content: settings.skill2Content },
    { name: settings.skill3Name, content: settings.skill3Content },
  ].filter((s) => s.content);

  if (skills.length > 0) {
    prompt += `\n## Your Special Skills & Instructions\n`;
    skills.forEach((s) => {
      if (s.name) prompt += `\n### ${s.name}\n`;
      prompt += `${s.content}\n`;
    });
  }

  // Admin extras
  if (isAdmin) {
    // Fetch admin-specific data
    const [enquiries, donations] = await Promise.all([
      storage.getEnquiries(),
      storage.getDonations(),
    ]);

    const recentEnquiries = enquiries.slice(0, 5).map((e: any) =>
      `- ${e.name} (${e.email}): "${e.message?.slice(0, 100) || ""}"`
    ).join("\n");

    const totalDonations = donations.reduce((sum: number, d: any) => sum + (parseFloat(d.amount) || 0), 0);

    prompt += `\n## Admin Context (Only visible to admins)
You have access to admin data. Recent enquiries (last 5):
${recentEnquiries || "No enquiries yet."}

Total donations received: $${totalDonations.toFixed(2)} across ${donations.length} donation(s).

You can also help the admin:
- Generate artist bios and CSV-ready data (plain text, no markdown formatting)
- Summarise enquiries or suggest responses
- Provide insights about the event data
- Help with content creation for the platform

When generating artist data for CSV import, always output in this exact format (plain text, no markdown):
Name: [name]
Genre: [genre]
Description: [short description]
Bio: [longer bio]
Origin: [city/country]
Members: [member names]
`;
  }

  prompt += `\n## Trivia
When asked for trivia or when sharing a proactive trivia fact, share one interesting, specific, and verifiable fact about one of the artists playing, or about music history related to their genre. Keep it concise and engaging.

## Guidelines
- Be friendly, enthusiastic, and helpful
- Keep responses concise (2-3 paragraphs max unless asked for more)
- If you don't know something specific about the venue or local area, say so honestly
- Never make up set times, prices, or logistics — only share what's in your context
`;

  return prompt;
}

export async function callConciergeAI(
  messages: { role: string; content: string }[],
  systemPrompt: string,
  settings: ConciergeSettings
): Promise<string> {
  const { provider, apiKey, model } = settings;

  if (!apiKey) throw new Error("No API key configured for the concierge.");

  if (provider === "anthropic") {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model || "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Anthropic API error: ${err}`);
    }
    const data = await resp.json();
    return data.content?.[0]?.text || "No response";
  } else {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        max_tokens: 1024,
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`OpenAI API error: ${err}`);
    }
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || "No response";
  }
}

export async function generateArtistData(
  artistName: string,
  settings: ConciergeSettings
): Promise<Record<string, string>> {
  const systemPrompt = `You are a music database assistant. When given a band or artist name, you output factual information about them in a structured plain text format. Always use plain text only — no markdown, no asterisks, no bullet points, no formatting. If you don't know something, leave it blank.

Output format (each field on its own line):
Name: [artist name]
Genre: [primary genre]
Description: [one sentence description, max 150 chars]
Bio: [2-3 sentence biography, plain text only]
Origin: [city, country]
Members: [member names comma separated, or blank if solo]
Website: [official website URL or blank]`;

  const userMessage = `Generate artist data for: ${artistName}`;

  const reply = await callConciergeAI(
    [{ role: "user", content: userMessage }],
    systemPrompt,
    settings
  );

  // Parse the response into fields
  const result: Record<string, string> = {};
  const lines = reply.split("\n");
  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim().toLowerCase();
      const value = line.slice(colonIdx + 1).trim();
      if (key && value) result[key] = value;
    }
  }
  return result;
}
