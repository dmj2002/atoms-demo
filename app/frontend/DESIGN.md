## Direction & Layout
- Product: Atoms Demo — an agent-driven app builder. Mood: focused developer workshop, calm and precise; not a neon "AI" toy. First signal: a dark chat rail on the left with named agents (Emma / Alex) working, and a bright canvas on the right showing the live app.
- Defining idea: "Agent rail + live canvas" 32/68 split; the canvas sits on a warm off-white board framed inside the dark shell like a monitor. Reference: atoms.dev editor.
- Layout: full viewport, header 52px; left panel 380px (min 320), right flexible. Mobile (<900px): panels stack, tab switch between Chat / Workspace.
- Do: agent avatars with distinct colors, monospace for code and file names, single accent (lime). Don't: purple-blue gradients, glowing cards, glassmorphism.

## Tokens
- Colors: shell bg #111214, panel #17181B, surface #1F2024, border #2A2C31, text #ECECEC, muted #8B8D93, accent lime #C6F432 (text on accent #111214), Emma coral #FF8A65, Alex cyan #4DD0E1, error #FF5C5C, canvas board #F4F1EA.
- Type: "Space Grotesk" (UI, 14px/1.5, headings 600 18–28px), "JetBrains Mono" (code 12.5px/1.6, file names 12px).
- Spacing 4/8/12/16/24; radii: inputs/buttons 8px, cards 12px, avatars circular, canvas 14px.
- Elevation: borders 1px #2A2C31; only the canvas has shadow 0 10px 30px rgba(0,0,0,.35).

## Shared Patterns & States
- Agent message: avatar circle + name + bubble on surface; working state shows pulsing dot; error shows red border.
- Composer: textarea on surface, accent send button (icon, aria-label), disabled while generating; stop button while streaming.
- Workspace tabs: 预览 / 代码 / 版本; code tab = file tree (220px) + numbered code view.
- Empty state: headline + example prompt chips.
- Motion: 150ms ease-out hovers only. Focus ring 2px accent. Targets ≥36px.

## Media
Operational tool UI; no imagery needed. Generated apps provide the visual content.
