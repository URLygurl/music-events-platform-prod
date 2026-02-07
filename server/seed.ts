import { db } from "./db";
import { artists, events, siteSettings } from "@shared/schema";
import { sql } from "drizzle-orm";

export async function seedDatabase() {
  const [existingArtists] = await db.select({ count: sql<number>`count(*)` }).from(artists);
  if (!existingArtists || Number(existingArtists.count) === 0) {
    console.log("Seeding artists & events...");
    await db.insert(artists).values([
      { name: "DJ Momentum", genre: "House / Deep House", description: "DJ Momentum brings pulsating deep house rhythms that move the crowd from the first beat. Known for seamless transitions and an instinct for the dancefloor, Momentum has played at festivals across the country.", imageUrl: "", email: "momentum@example.com", phone: "+1 555-0101", socialLinks: "https://instagram.com/djmomentum", timeSlot: "22:00 - 00:00", featured: true, promoterImageUrl: "" },
      { name: "Vox Luna", genre: "Indie Pop / Electronic", description: "Vox Luna blends ethereal vocals with electronic beats to create a dreamy sonic landscape. Her live performances weave looping and layering into a captivating one-woman show.", imageUrl: "", email: "voxluna@example.com", phone: "+1 555-0102", socialLinks: "https://instagram.com/voxluna", timeSlot: "20:00 - 21:30", featured: true, promoterImageUrl: "" },
      { name: "The Brass Assembly", genre: "Jazz / Funk", description: "A seven-piece brass ensemble that fuses classic jazz with modern funk grooves. The Brass Assembly brings high energy and tight arrangements to every performance.", imageUrl: "", email: "brass@example.com", phone: "+1 555-0103", socialLinks: "https://instagram.com/brassassembly", timeSlot: "18:00 - 19:30", featured: true, promoterImageUrl: "" },
      { name: "Neon Pulse", genre: "Synthwave / Retro", description: "Neon Pulse takes audiences on a journey through retro-futuristic soundscapes. Combining analogue synths with modern production, each set feels like a soundtrack to a film that hasn't been made yet.", imageUrl: "", email: "neonpulse@example.com", phone: "+1 555-0104", socialLinks: "https://instagram.com/neonpulse", timeSlot: "00:00 - 02:00", featured: true, promoterImageUrl: "" },
      { name: "Roots Collective", genre: "Reggae / Dub", description: "Roots Collective brings authentic reggae and dub vibrations with live instrumentation.", imageUrl: "", email: "roots@example.com", phone: "+1 555-0105", socialLinks: "https://instagram.com/rootscollective", timeSlot: "16:00 - 17:30", featured: false, promoterImageUrl: "" },
      { name: "MC Frequency", genre: "Hip Hop / Spoken Word", description: "MC Frequency delivers sharp lyricism and powerful spoken word over original beats.", imageUrl: "", email: "frequency@example.com", phone: "+1 555-0106", socialLinks: "https://instagram.com/mcfrequency", timeSlot: "19:30 - 20:00", featured: false, promoterImageUrl: "" },
      { name: "Aurora Keys", genre: "Classical Crossover", description: "Aurora Keys reimagines classical piano pieces with electronic arrangements.", imageUrl: "", email: "aurora@example.com", phone: "+1 555-0107", socialLinks: "https://instagram.com/aurorakeys", timeSlot: "15:00 - 16:00", featured: false, promoterImageUrl: "" },
      { name: "Bass Theory", genre: "Drum & Bass / Jungle", description: "Bass Theory delivers relentless drum and bass sets that push the boundaries of tempo and texture.", imageUrl: "", email: "basstheory@example.com", phone: "+1 555-0108", socialLinks: "https://instagram.com/basstheory", timeSlot: "02:00 - 04:00", featured: false, promoterImageUrl: "" },
    ]);
    await db.insert(events).values([
      { name: "Summer Sound Festival 2026", description: "A full day of live music across three stages.", imageUrl: "", date: "July 15, 2026", venue: "Riverside Park Amphitheatre" },
      { name: "Midnight Sessions", description: "An intimate late-night electronic music showcase.", imageUrl: "", date: "August 22, 2026", venue: "The Warehouse, Downtown" },
    ]);
  }

  const [existingSettings] = await db.select({ count: sql<number>`count(*)` }).from(siteSettings);
  if (!existingSettings || Number(existingSettings.count) === 0) {
    console.log("Seeding default settings...");
    await db.insert(siteSettings).values([
      { key: "menu_show_home", value: "true", type: "toggle", section: "navigation", label: "Show Home in Menu" },
      { key: "menu_show_artists", value: "true", type: "toggle", section: "navigation", label: "Show Artists in Menu" },
      { key: "menu_show_events", value: "true", type: "toggle", section: "navigation", label: "Show Events in Menu" },
      { key: "menu_show_ds", value: "true", type: "toggle", section: "navigation", label: "Show DS in Menu" },
      { key: "menu_show_profile", value: "true", type: "toggle", section: "navigation", label: "Show Profile in Menu" },
      { key: "menu_show_donate", value: "true", type: "toggle", section: "navigation", label: "Show Donate in Menu" },
      { key: "menu_show_admin", value: "true", type: "toggle", section: "navigation", label: "Show Admin in Menu" },
      { key: "menu_show_integrations", value: "true", type: "toggle", section: "navigation", label: "Show Integrations in Menu" },
      { key: "global_company_name", value: "[ Company Name ]", type: "text", section: "global", label: "Company Name" },
      { key: "global_logo_image", value: "", type: "image", section: "global", label: "Logo / Header Image" },
      { key: "global_primary_color", value: "#000000", type: "color", section: "style", label: "Primary Color" },
      { key: "global_secondary_color", value: "#ffffff", type: "color", section: "style", label: "Secondary Color" },
      { key: "global_accent_color", value: "#666666", type: "color", section: "style", label: "Accent Color" },
      { key: "global_font_heading", value: "Inter", type: "font", section: "style", label: "Heading Font" },
      { key: "global_font_body", value: "Inter", type: "font", section: "style", label: "Body Font" },
      { key: "login_welcome_text", value: "Welcome", type: "text", section: "login", label: "Welcome Heading" },
      { key: "login_subtitle", value: "Sign in to access the platform", type: "text", section: "login", label: "Subtitle" },
      { key: "login_header_image", value: "", type: "image", section: "login", label: "Header Image" },
      { key: "landing_heading_text", value: "[ Heading Text ]", type: "text", section: "landing", label: "Heading Banner Text" },
      { key: "landing_search_placeholder", value: "Search artists...", type: "text", section: "landing", label: "Search Placeholder" },
      { key: "landing_banner_image", value: "", type: "image", section: "landing", label: "Bottom Banner Image" },
      { key: "landing_enquiry_title", value: "Enquire / Subscribe", type: "text", section: "landing", label: "Enquiry Section Title" },
      { key: "artists_page_title", value: "Artists", type: "text", section: "artists_dir", label: "Page Title" },
      { key: "events_page_title", value: "Events", type: "text", section: "events", label: "Page Title" },
      { key: "ds_page_title", value: "DS", type: "text", section: "ds", label: "Page Title" },
      { key: "ds_content_text", value: "[ DS content area — customisable ]", type: "text", section: "ds", label: "Content Text" },
      { key: "ds_content_image", value: "", type: "image", section: "ds", label: "Content Image" },
      { key: "nav_home_label", value: "Home", type: "text", section: "navigation", label: "Home Button Label" },
      { key: "nav_artists_label", value: "Artists", type: "text", section: "navigation", label: "Artists Button Label" },
      { key: "nav_events_label", value: "Events", type: "text", section: "navigation", label: "Events Button Label" },
      { key: "nav_ds_label", value: "DS", type: "text", section: "navigation", label: "DS Button Label" },
      { key: "nav_profile_label", value: "Profile", type: "text", section: "navigation", label: "Profile Button Label" },
    ]);
  }

  const requiredSettings = [
    { key: "menu_show_home", value: "true", type: "toggle", section: "navigation", label: "Show Home in Menu" },
    { key: "menu_show_artists", value: "true", type: "toggle", section: "navigation", label: "Show Artists in Menu" },
    { key: "menu_show_events", value: "true", type: "toggle", section: "navigation", label: "Show Events in Menu" },
    { key: "menu_show_ds", value: "true", type: "toggle", section: "navigation", label: "Show DS in Menu" },
    { key: "menu_show_profile", value: "true", type: "toggle", section: "navigation", label: "Show Profile in Menu" },
    { key: "menu_show_donate", value: "true", type: "toggle", section: "navigation", label: "Show Donate in Menu" },
    { key: "menu_show_admin", value: "true", type: "toggle", section: "navigation", label: "Show Admin in Menu" },
    { key: "menu_show_integrations", value: "true", type: "toggle", section: "navigation", label: "Show Integrations in Menu" },
    { key: "google_sheet_enquiries", value: "", type: "text", section: "integrations_sheets", label: "Enquiries Sheet (ID|SheetName)" },
    { key: "google_sheet_donations", value: "", type: "text", section: "integrations_sheets", label: "Donations Sheet (ID|SheetName)" },
    { key: "bg_landing", value: "", type: "image", section: "wallpapers", label: "Landing Page Background" },
    { key: "bg_artists", value: "", type: "image", section: "wallpapers", label: "Artists Page Background" },
    { key: "bg_events", value: "", type: "image", section: "wallpapers", label: "Events Page Background" },
    { key: "bg_ds", value: "", type: "image", section: "wallpapers", label: "DS Page Background" },
    { key: "bg_login", value: "", type: "image", section: "wallpapers", label: "Login Page Background" },
    { key: "custom_font_name", value: "", type: "text", section: "style", label: "Custom Font Name" },
    { key: "custom_font_url", value: "", type: "text", section: "style", label: "Custom Font File URL" },
    { key: "social_instagram", value: "", type: "text", section: "social", label: "Instagram URL" },
    { key: "social_facebook", value: "", type: "text", section: "social", label: "Facebook URL" },
    { key: "social_twitter", value: "", type: "text", section: "social", label: "X (Twitter) URL" },
    { key: "social_tiktok", value: "", type: "text", section: "social", label: "TikTok URL" },
    { key: "social_youtube", value: "", type: "text", section: "social", label: "YouTube URL" },
    { key: "social_soundcloud", value: "", type: "text", section: "social", label: "SoundCloud URL" },
    { key: "social_spotify", value: "", type: "text", section: "social", label: "Spotify URL" },
    { key: "social_bandcamp", value: "", type: "text", section: "social", label: "Bandcamp URL" },
    { key: "social_website", value: "", type: "text", section: "social", label: "Website URL" },
    { key: "social_email", value: "", type: "text", section: "social", label: "Contact Email" },
    { key: "anim_box_1_text", value: "", type: "text", section: "animations", label: "Animation Box 1 Text" },
    { key: "anim_box_1_style", value: "fade-in", type: "text", section: "animations", label: "Animation Box 1 Style" },
    { key: "anim_box_1_bg", value: "", type: "image", section: "animations", label: "Animation Box 1 Background" },
    { key: "anim_box_2_text", value: "", type: "text", section: "animations", label: "Animation Box 2 Text" },
    { key: "anim_box_2_style", value: "slide-up", type: "text", section: "animations", label: "Animation Box 2 Style" },
    { key: "anim_box_2_bg", value: "", type: "image", section: "animations", label: "Animation Box 2 Background" },
    { key: "anim_box_3_text", value: "", type: "text", section: "animations", label: "Animation Box 3 Text" },
    { key: "anim_box_3_style", value: "slide-left", type: "text", section: "animations", label: "Animation Box 3 Style" },
    { key: "anim_box_3_bg", value: "", type: "image", section: "animations", label: "Animation Box 3 Background" },
  ];
  for (const s of requiredSettings) {
    await db.insert(siteSettings).values(s).onConflictDoNothing({ target: siteSettings.key });
  }

  console.log("Seeding complete.");
}
