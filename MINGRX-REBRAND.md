# Mingrx — Rebrand Preview

This branch converts the Banana Cord 2.1 product experience into **Mingrx** while intentionally preserving the mature voice, screen sharing, chat, Firebase, E2EE and updater engines.

## Visual direction
- Clean, smooth, premium and lightweight.
- Graphite surfaces instead of high-contrast black blocks.
- Violet is an accent, not a glow effect.
- Horizontal space/community switcher instead of a Discord-style vertical server rail.
- Members are contextual in a drawer instead of permanently occupying a fourth column.
- Compact typography, restrained borders, short transitions and no decorative animation loops.

## Preview safety
The preview uses `com.mingrx.preview` and `Mingrx Preview`, so test installs do not overwrite stable Banana Cord installations. This is temporary. Production migration/updater compatibility will be handled only after the rebrand is approved.

## Compatibility principle
Internal legacy identifiers can remain during the preview when renaming them would add risk without changing the user experience. User-facing product identity must be Mingrx.
