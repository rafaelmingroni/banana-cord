# Mingrx 3.0 — Public Migration

Mingrx 3.0 is the public evolution of the project previously distributed as Banana Cord.

## Product identity

The user-facing product is now **Mingrx**:
- application name: Mingrx
- installer: `Mingrx-Setup-<version>-x64.exe`
- Windows shortcuts and tray: Mingrx
- primary invite protocol: `mingrx://`
- documentation, release notes and public invite page: Mingrx

## Migration compatibility

A small number of legacy technical identifiers intentionally remain during the 3.0 migration. They are not user-facing branding.

- `com.bananacord.app` remains the Windows application ID so existing installations upgrade in place.
- `bananacord://` remains accepted temporarily so old invite links do not break.
- the GitHub repository slug remains `banana-cord` for this migration release so installed 2.x clients keep finding `latest.yml` and the 3.0 installer.
- internal `banana.*` localStorage keys and IPC/event names remain stable to preserve preferences, update state, E2EE material and compatibility with mature runtime modules.
- the Firebase project keeps its existing technical project ID; renaming a Firebase project is not required for a product rebrand.

## Data continuity

On Windows, Mingrx 3.0 detects the existing Banana Cord user-data directory and reuses it for the migration release. This preserves Firebase login state, local preferences and the local encrypted key vault. Fresh Mingrx installations use the normal Mingrx profile path.

## Visual direction

- clean, smooth and lightweight
- graphite surfaces with restrained violet accents
- theme-aware Mingrx marks
- two-column shell with contextual member drawer
- responsive private/social layout
- no decorative animation loops or heavy effects that would compete with games

## Release rule

Mingrx 3.0 is published only after the launch regression suite, Firebase rules emulators, real Electron interaction tests, multi-resolution layout sweep and Windows installer verification pass on the exact release commit.
