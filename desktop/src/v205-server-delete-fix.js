/* Banana Cord V2.0.5 compatibility marker.
 * The old external Firestore monkey patch is intentionally disabled as of V2.0.9.
 * Server deletion is now patched inside the single Banana Cloud browser bundle so
 * Firestore references and functions always come from the same Firebase runtime.
 */
(() => {
  window.__bananaV205ServerDeleteFix = true;
})();
