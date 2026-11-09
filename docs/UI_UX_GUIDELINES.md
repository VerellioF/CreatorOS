# UI/UX DESIGN SYSTEM & GUIDELINES — CREATOROS AI

## 1. DESIGN PHILOSOPHY & INSPIRATION

CreatorOS AI embodies the craftsmanship and precision of modern productivity software:
- **Visual References:** Linear, Notion, Raycast, Supabase Dashboard.
- **Atmosphere:** Refined, focused, calm, and high-performance. Avoid excessive chaotic gradients, childish cartoon avatars, and bloated AI card grids.
- **Principle:** Content is king. The interface recedes gracefully into the background, highlighting the creator's ideas, scripts, and media.
- **Language Tone:** Bahasa Indonesia first (natural, modern professional creator jargon like "Ide Konten", "Pilar Konten", "Scriptwriter"), paired with clean international typography.

---

## 2. COLOR PALETTE & DESIGN TOKENS

### 2.1 Dark Mode (Primary Creator Canvas)
- **Background Root:** `hsl(240, 10%, 4%)` (`#09090b`)
- **Card / Surface Default:** `hsl(240, 10%, 7%)` (`#121215`)
- **Card / Surface Elevated:** `hsl(240, 10%, 10%)` (`#18181c`)
- **Borders & Dividers:** `hsl(240, 6%, 16%)` (`#27272a`)
- **Text Primary:** `hsl(0, 0%, 98%)` (`#fafafa`)
- **Text Secondary / Muted:** `hsl(240, 5%, 65%)` (`#a1a1aa`)
- **Primary Accent:** `hsl(238, 84%, 67%)` (`#6366f1` Indigo / Electric Purple)
- **Primary Accent Foreground:** `hsl(0, 0%, 100%)`
- **Success:** `hsl(142, 71%, 45%)` (`#22c55e`)
- **Warning:** `hsl(38, 92%, 50%)` (`#eab308`)
- **Destructive:** `hsl(0, 84%, 60%)` (`#ef4444`)

### 2.2 Light Mode
- **Background Root:** `hsl(0, 0%, 100%)` (`#ffffff`)
- **Card / Surface Default:** `hsl(240, 5%, 98%)` (`#f8fafc`)
- **Card / Surface Elevated:** `hsl(0, 0%, 100%)`
- **Borders & Dividers:** `hsl(240, 6%, 90%)` (`#e2e8f0`)
- **Text Primary:** `hsl(240, 10%, 4%)` (`#09090b`)
- **Text Secondary / Muted:** `hsl(240, 4%, 46%)` (`#64748b`)
- **Primary Accent:** `hsl(238, 84%, 59%)` (`#4f46e5`)

---

## 3. TYPOGRAPHY & SPACING SYSTEM

- **Primary Font Family:** **Plus Jakarta Sans** (configured via `next/font/google` and CSS variable `--font-sans`), with fallbacks (`Inter`, `-apple-system`, `BlinkMacSystemFont`, `sans-serif`).
  - *Visibility Rationale:* Selected for high optical clarity, generous x-height, wide open apertures, and superior contrast legibility across dense dashboard data and mobile screens in Bahasa Indonesia.
- **Code & Metadata Font:** **JetBrains Mono** (configured via `next/font/google` and CSS variable `--font-mono`), paired with `.tabular-nums` for precise alignment of token counts, timestamps, and analytics figures.
- **Scale:**
  - Display: `32px` (2rem), Line Height `1.2`, Weight `700`
  - H1: `24px` (1.5rem), Line Height `1.3`, Weight `600`
  - H2: `20px` (1.25rem), Line Height `1.35`, Weight `600`
  - H3: `16px` (1rem), Line Height `1.4`, Weight `600`
  - Body: `14px` (0.875rem), Line Height `1.5`, Weight `400`
  - Small / Caption: `12px` (0.75rem), Line Height `1.4`, Weight `500`
- **Spacing Scale:** Standard 4px grid (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`, `64px`).
- **Border Radii:** `rounded-lg` (8px default), `rounded-md` (6px buttons/inputs), `rounded-full` (badges/avatars).

---

## 4. CORE COMPONENT CONTRACTS

All interactive components must adhere to strict accessibility and state guidelines:
1. **Interactive States:** Explicit `hover`, `active`, `focus-visible`, and `disabled` styles.
2. **Loading States:** No frozen interfaces. Long-running actions must render inline button spinners or skeleton wrappers.
3. **Empty States:** Whenever a list has 0 items (e.g. 0 ideas, 0 scripts), render an illustrated empty state with:
   - Descriptive title and explanatory subtitle.
   - Primary call-to-action button (e.g., "Hasilkan Ide Pertama").
4. **Error Boundaries:** Friendly error displays with a "Coba Lagi" (Retry) button and safe error messaging.

---

## 5. APPLICATION SHELL & NAVIGATION ARCHITECTURE

### 5.1 Sidebar Navigation Structure
- **WORKSPACE**
  - Dashboard (`/dashboard`)
  - Creator Profile (`/creator-profile`)
  - Niche Discovery (`/niche-discovery`)
  - AI Assistant (`/ai-assistant`)
- **RESEARCH & STRATEGY**
  - Trend Research (`/trends`)
  - Competitor Research (`/competitors`)
  - Content Strategy (`/strategy`)
  - Idea Generator (`/ideas`)
- **CONTENT STUDIO**
  - Script Studio (`/studio/scripts`)
  - Storyboard Studio (`/studio/storyboard`)
  - Image Studio (`/studio/images`)
  - Video Studio (`/studio/video`)
  - Voice Studio (`/studio/voice`)
- **PUBLISHING & GROWTH**
  - Content Calendar (`/calendar`)
  - Publishing Center (`/publishing`)
  - Analytics (`/analytics`)
  - Monetization Hub (`/monetization`)
- **SYSTEM**
  - Agent Workspace (`/agents`)
  - Usage & Credits (`/usage`)
  - Settings (`/settings`)

### 5.2 Top Header
- Active Workspace Switcher dropdown with quick "Create New Workspace" modal.
- Global Search trigger (`Cmd + K` / `Ctrl + K`).
- Real-time Credit Balance Pill badge.
- Theme Toggle (`Dark` / `Light` / `System`).
- User Profile Menu with quick link to Settings and Sign Out.
