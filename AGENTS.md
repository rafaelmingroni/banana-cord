# Mingrx release instructions

These release conventions were requested by Rafael and apply to future releases.

- Public version numbers progress as `3.2`, `3.2.1` through `3.2.9`, then `3.3`. Keep full SemVer in package.json, the lockfile, tags, installer names and updater metadata: public `3.2` is technical `3.2.0`. Never introduce patch 10 or higher for a new release.
- Use `npm run release:next` from desktop to advance the version and synchronize the README version block and lockfile. An explicit version can be set with `node scripts/release-version.js --set VERSION`.
- Every release must update README.md with the current version and relevant behavior/architecture, and include RELEASE_NOTES-<technical-version>.md. Its heading and GitHub release title use the public version. Preserve the README's live GitHub release badge.
- Run `npm run release:check`. The Windows release workflow blocks publication if the README, package or release notes disagree.
- Preserve existing Windows app identity, legacy invite compatibility and automatic updates. Do not replace already-published installers or updater metadata under an existing version.
- Use the release workflow's authorization, session migration, real two-account calls and updater tests before publishing changes to authentication or Firebase rules. Required backend rules must be deployed and verified before promoting the installer.
- Never claim that a local client-side check enforces a backend security policy or that a configuration is active in production without checking deployment evidence.
