/* Banana Cord V2.0.7 social compatibility shim.
 * V2.0.11 moved all Firebase social/DM logic into the single Banana Cloud bundle.
 * Keep this file loaded for compatibility, but never create a second Firestore runtime here.
 */
(() => {
  if (window.__bananaV207SocialFix) return;
  window.__bananaV207SocialFix = true;
  try { window.BananaV211PatchSocialSocket?.(window.BananaCloudSocket); } catch {}
})();
