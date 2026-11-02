# MockVue design system

Warm, editorial, calm. Paper-like ivory surfaces with burgundy ink in light mode; a warm "night study" palette in dark mode.
The interface should feel like a considered exam paper, not a dashboard of neon widgets.

## Tokens

Every color is a CSS variable holding RGB channels (`client/src/index.css`) and mapped to Tailwind names in
`client/tailwind.config.js`, so `bg-accent/10` works and dark mode is a single token swap (`:root.dark`), never `dark:` duplicated
on every element.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `canvas` | `#F7F4EE` | `#12100E` | Page background |
| `surface` / `surface-2` / `surface-3` | `#FFFDF9` / `#F1ECE4` / `#E8E2D8` | `#1B1815` / `#24201C` / `#2E2924` | Cards, wells, tracks |
| `line` / `line-strong` | `#E2DCD2` / `#CDC5B9` | `#332E29` / `#48413A` | Hairline borders |
| `ink` / `ink-2` / `ink-3` | `#1A1816` / `#58534D` / `#756F68` | `#F3EFE8` / `#B8B1A7` / `#968F85` | Primary / secondary / muted text (all ≥ 4.5:1 on surface) |
| `accent` | `#7A263A` | `#9C3851` | Primary buttons, selection |
| `accent-ink` | `#7A263A` | `#ECA0B2` | Accent text and links |
| `brass` | `#8C642A` | `#D9B26F` | Secondary accent, "suggested" hints |
| `success` / `warning` / `danger` | `#2F6B4A` / `#965A12` / `#A33434` | `#7FCCA0` / `#E7B05C` / `#F08A8A` | Status — always paired with a label or icon |

Each has a `-soft` background variant; `-fg` gives the readable text color on a filled status background.

## Typography

- **Newsreader** (serif, 500–700) — page titles, question text, the wordmark.
- **Plus Jakarta Sans** — everything else. Numbers use tabular figures (`.num`).
- **JetBrains Mono** — only the interview countdown timer.
- Minimum UI text is 12 px; body copy is 14–16 px with relaxed line height.

## Components

`client/src/components/ui`: `Button` (polymorphic — use `as={Link}` instead of nesting a button in a link), `IconButton`, `Card`,
`Badge`, `Field`/`Input`/`PasswordInput`/`Select`/`Textarea`/`Chip`/`ChoiceCard`, `Alert`/`EmptyState`/`ErrorState`/`Skeleton`,
`Dialog`/`ConfirmDialog` (focus-trapped), `ScoreRing`, `Meter`, `StatTile`, `ScorePill`. Toasts come from `ToastContext`.

## Charts

Built with Recharts following the data-viz method: single-series charts use one accent hue (validated: `#9B3049` light /
`#C25E76` dark); score bands use the status trio (`#2F7A50 #C98A12 #B3364A` light, `#3E9E80 #BE8B1F #E0607A` dark), always with
value labels. 2 px lines, 8 px dots with a surface ring, hairline solid grids, ≤ 20 px bars with 4 px rounded ends, hover tooltips,
and a "Table" toggle on every chart. Colors live in `client/src/lib/chartTheme.js`.

## Principles

- Plain, specific copy. No marketing filler, no invented statistics.
- Color is never the only signal (scores carry a band label, statuses an icon or text).
- Focus is always visible; dialogs trap focus; everything works by keyboard.
- Respect `prefers-reduced-motion`; animations are short and functional.
- The interview room has no navigation chrome — just the question, the answer, the timer and the proctoring panel.
