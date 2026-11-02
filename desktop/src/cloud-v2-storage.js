/* Mingrx Cloud Storage bridge.
 * IMPORTANT: this file is bundled with cloud-v2.js so it shares the exact same
 * Firebase SDK registry/app instance. Do not move uploads back to a standalone
 * renderer require('firebase/storage') or Firebase will see a second registry.
 */
(() => {
  if (window.__mingrxCloudStorageBridge) return;
  window.__mingrxCloudStorageBridge = true;

  const { getApps } = require('firebase/app');
  const { getStorage, ref: storageRef, uploadBytes, getDownloadURL, deleteObject } = require('firebase/storage');

  function firebaseApp() {
    const app = getApps()[0];
    if (!app) throw new Error('Mingrx Cloud ainda não inicializou o Firebase. Tente novamente em alguns segundos.');
    return app;
  }

  function verifiedUser() {
    const user = window.BananaCloud?.user;
    if (!user?.uid || !user?.emailVerified) throw new Error('Entre em uma conta Mingrx com e-mail verificado para enviar imagens.');
    return user;
  }

  async function uploadImage(path, blob, metadata = {}) {
    verifiedUser();
    if (!(blob instanceof Blob) || !blob.size) throw new Error('A imagem preparada está vazia.');
    if (blob.size > 2 * 1024 * 1024) throw new Error('A imagem compactada ultrapassou 2 MB.');
    const storage = getStorage(firebaseApp());
    const objectRef = storageRef(storage, String(path || ''));
    const snapshot = await uploadBytes(objectRef, blob, {
      contentType: blob.type || 'image/webp',
      cacheControl: 'public,max-age=31536000,immutable',
      ...metadata
    });
    return getDownloadURL(snapshot.ref);
  }

  async function deleteImage(path) {
    verifiedUser();
    const storage = getStorage(firebaseApp());
    await deleteObject(storageRef(storage, String(path || '')));
  }

  window.MingrxCloudStorage = Object.freeze({ uploadImage, deleteImage });
  // Compatibility object name remains internal so the established Cloud runtime
  // and old updater path do not need a breaking migration.
  if (window.BananaCloud && window.BananaCloud.configured !== false) {
    window.BananaCloud.uploadImage = uploadImage;
    window.BananaCloud.deleteImage = deleteImage;
  }
})();
