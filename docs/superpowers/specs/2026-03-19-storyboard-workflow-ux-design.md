# Storyboard Workflow UX Improvements

**Date:** 2026-03-19
**Status:** Approved
**Scope:** Three additive UX improvements to the storyboard module to reduce manual tab-switching and accordion-management friction.

---

## Problem

The storyboard workflow requires too much manual navigation:

1. **Shot editing is fragmented** — modifying a single shot requires manually expanding/collapsing 4 separate accordion sections per card. When reviewing 10–20 shots this is repetitive.
2. **Cross-module tab switching** — in reference mode, users must navigate between the Characters page and Storyboard page to manage reference images, losing their scroll position each time.
3. **No pipeline progress overview** — users cannot see at a glance which shots are blocked at which pipeline stage. They must scroll through all cards to find shots that need attention.

---

## Solution Overview

Three additive features, all on the Storyboard page. No routes are removed; the Characters page remains intact.

---

## Feature A: Shot Edit Drawer

### Behavior

- Clicking the header area of a Shot Card opens a right-side drawer
- The Shot Card list collapses to a compact "row" mode while the drawer is open
- The drawer displays all pipeline steps fully expanded (no accordion) in a single scrollable panel
- Arrow buttons at the top of the drawer navigate to the previous/next shot without closing
- Closing the drawer (× button or Escape key) returns focus to the shot list

### Drawer Layout

```
┌─────────────────────────────────────────────┐
│  Shot 3  ←  →                             × │
├─────────────────────────────────────────────┤
│  [Step 1: Text]                             │
│  Scene description textarea                 │
│  Start frame / End frame textareas          │
│  Motion script textarea                     │
│  Camera direction input                     │
│  Dialogues (read-only list)                 │
│  [Rewrite] button                           │
├─────────────────────────────────────────────┤
│  [Step 2: Frames]                           │
│  Thumbnail pair (or scene ref frame)        │
│  [Generate] / [Regenerate] buttons          │
├─────────────────────────────────────────────┤
│  [Step 3: Video Prompt]                     │
│  Editable textarea (monospace)              │
│  [Generate] / [Regenerate] buttons          │
├─────────────────────────────────────────────┤
│  [Step 4: Video]                            │
│  Video player thumbnail                     │
│  [Generate] / [Regenerate] buttons          │
└─────────────────────────────────────────────┘
```

### Shot List in Compact Mode

When the drawer is open, Shot Cards in the list switch to a compact single-line row:

```
[1] [thumb][thumb][video-thumb]  Scene description...  ●●○○
[2] ...
```

Clicking a row switches the drawer to that shot.

### Components

- New component: `src/components/editor/shot-drawer.tsx`
- `ShotCard` gains an `onOpenDrawer` prop and an `isCompact` mode
- `StoryboardPage` manages `openDrawerShotId: string | null` state

### Data Flow

The drawer reads from the same `project.shots` array already in the store. Mutations (`patchShot`, generate actions) use the same existing API calls as the card. After mutation, `onUpdate()` triggers `fetchProject` which refreshes the store and re-renders the drawer.

---

## Feature B: Characters Inline Panel

### Behavior

- A collapsible panel appears at the top of the Storyboard control block, above the batch operation rows
- The panel shows all project characters as thumbnail cards with their reference image status
- Each character card has an inline upload button (if no reference image) or a regenerate button
- When in reference mode and any character lacks a reference image, the panel auto-expands on mount and shows an amber border
- Collapse/expand state is persisted to `localStorage` keyed by project ID
- A "Edit in Characters page →" link at the panel footer navigates to the full characters page

### Panel Layout

```
┌─────────────────────────────────────────────┐
│  👥 角色参考图  [reference mode badge]   ▲   │
├─────────────────────────────────────────────┤
│  [Aria ✓]  [Marcus ⚠ Upload]  [Elder ✓]    │
│                          Edit in Characters →│
└─────────────────────────────────────────────┘
```

### Components

- New component: `src/components/editor/characters-inline-panel.tsx`
- Uses existing `CharacterCard` logic for individual upload/generate actions (inline, not the full card UI)
- `StoryboardPage` renders this panel inside the control block, conditionally or always visible

### Data Flow

Reads `project.characters` from the store. Upload/generate calls reuse the existing character API routes (`PATCH /api/projects/[id]/characters/[characterId]`). After any mutation, calls `fetchProject` to refresh.

---

## Feature C: Pipeline Kanban View

### Behavior

- A view toggle (List | Kanban) appears in the Storyboard page header, right side
- Kanban view replaces the shot card list with a 4-column horizontal board
- Columns: **待生成帧** / **待生成提示词** / **待生成视频** / **已完成**
- Each column header shows shot count and a "Batch Generate (N)" button that triggers the existing batch API action for that stage
- Shot mini-cards show: sequence number, scene description snippet, and thumbnail if available
- Clicking a shot mini-card opens the Feature A drawer
- View preference is persisted to `localStorage`
- The batch operation control panel (rows 1–4) is hidden in kanban view; batching is done per-column

### Column Assignment Logic

| Column | Condition |
|---|---|
| 待生成帧 | `!hasFrame` |
| 待生成提示词 | `hasFrame && !hasVideoPrompt` |
| 待生成视频 | `hasVideoPrompt && !hasVideo` |
| 已完成 | `hasVideo` |

Where `hasFrame` = `sceneRefFrame || firstFrame || lastFrame`, same logic as current code.

### Components

- New component: `src/components/editor/shot-kanban.tsx`
- `StoryboardPage` manages `viewMode: "list" | "kanban"` state (localStorage persisted)
- Kanban column batch actions call the same handlers already on `StoryboardPage` (`handleBatchGenerateFrames`, `handleBatchGenerateVideoPrompts`, `handleBatchGenerateVideos`, `handleBatchGenerateSceneFrames`)

---

## Implementation Constraints

- No new API routes required — all features use existing endpoints
- No schema changes required
- No new stores — all state lives in component state or localStorage
- i18n: all new strings must be added to `messages/en.json`, `messages/zh.json`, `messages/ja.json`, `messages/ko.json`
- Existing `ShotCard` behavior (accordion mode) remains fully intact for the list view

---

## File Change Summary

| File | Change |
|---|---|
| `src/components/editor/shot-drawer.tsx` | New — full shot edit drawer |
| `src/components/editor/characters-inline-panel.tsx` | New — inline character panel |
| `src/components/editor/shot-kanban.tsx` | New — kanban board view |
| `src/components/editor/shot-card.tsx` | Add `isCompact` prop + `onOpenDrawer` prop |
| `src/app/[locale]/project/[id]/storyboard/page.tsx` | Wire up drawer state, inline panel, view toggle |
| `messages/*.json` | New i18n keys for all new UI strings |
