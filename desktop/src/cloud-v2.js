/* Banana Cord v2 Cloud foundation.
 * Auth + Firestore + Realtime Database. Media continues on WebRTC.
 */
(() => {
  const config = require('../cloud/firebase-config');
  const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const configured = required.every(k => String(config?.[k] || '').trim());

  const gate = document.createElement('div');
  gate.id = 'cloudGate';
  gate.className = 'cloud-gate';
  gate.innerHTML = `
    <div class="cloud-shell">
      <div class="cloud-brand"><img src="../assets/banana-cord.png" alt=""><div><h1>Banana Cord</h1><p>Conta Banana</p></div></div>
      <div id="cloudConfigMissing" class="cloud-panel ${configured ? 'hidden' : ''}">
        <h2>Banana Cloud ainda não configurado</h2>
        <p>A base da V2 está pronta, mas este build ainda precisa das credenciais públicas do projeto Firebase.</p>
        <code>desktop/cloud/firebase-config.js</code>
        <small>A versão estável continua funcionando normalmente na branch main.</small>
      </div>
      <div id="cloudAuth" class="cloud-panel ${configured ? '' : 'hidden'}">
        <div class="cloud-tabs"><button data-cloud-tab="login" class="active">Entrar</button><button data-cloud-tab="register">Criar conta</button></div>
        <form id="cloudLoginForm" class="cloud-form">
          <label>E-mail</label><input id="cloudLoginEmail" type="email" autocomplete="email" required>
          <label>Senha</label><input id="cloudLoginPassword" type="password" autocomplete="current-password" minlength="6" required>
          <button class="primary" type="submit">Entrar</button>
          <button id="cloudForgot" class="link-button" type="button">Esqueci minha senha</button>
        </form>
        <form id="cloudRegisterForm" class="cloud-form hidden">
          <label>Nome</label><input id="cloudRegisterName" maxlength="32" required>
          <label>E-mail</label><input id="cloudRegisterEmail" type="email" autocomplete="email" required>
          <label>Senha</label><input id="cloudRegisterPassword" type="password" autocomplete="new-password" minlength="6" required>
          <button class="primary" type="submit">Criar conta</button>
        </form>
        <div id="cloudAuthError" class="cloud-error hidden"></div>
      </div>
      <div id="cloudVerify" class="cloud-panel hidden">
        <h2>Verifique seu e-mail</h2>
        <p>Enviamos um link para <b id="cloudVerifyEmail"></b>. Depois de clicar no e-mail, volte aqui.</p>
        <div id="cloudVerifyError" class="cloud-error hidden"></div>
        <div class="cloud-actions"><button id="cloudVerified" class="primary">Já verifiquei</button><button id="cloudResend">Reenviar e-mail</button></div>
        <button id="cloudVerifyLogout" class="link-button">Usar outra conta</button>
      </div>
      <div id="cloudLoading" class="cloud-panel hidden"><div class="cloud-spinner"></div><p>Entrando no Banana Cord…</p></div>
    </div>`;
  document.body.appendChild(gate);

  if (!configured) {
    window.BananaCloud = { configured: false, ready: false };
    return;
  }

  const { initializeApp } = require('firebase/app');
  const {
    getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged,
    createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
    sendEmailVerification, sendPasswordResetEmail, updateProfile
  } = require('firebase/auth');
  const {
    initializeFirestore, persistentLocalCache, persistentSingleTabManager,
    collection, doc, setDoc, getDoc, addDoc, updateDoc, deleteDoc,
    query, orderBy, limit, onSnapshot, serverTimestamp, where, getDocs,
    writeBatch
  } = require('firebase/firestore');
  const { getDatabase, ref, set, onValue, onDisconnect, serverTimestamp: rtdbTimestamp } = require('firebase/database');

  const firebaseApp = initializeApp(config);
  const auth = getAuth(firebaseApp);
  auth.languageCode = 'pt-BR';
  setPersistence(auth, browserLocalPersistence).catch(console.warn);

  let db;
  try {
    db = initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() })
    });
  } catch (e) {
    console.warn('Banana Cloud: cache persistente indisponível, usando cache normal.', e?.message || e);
    const { getFirestore } = require('firebase/firestore');
    db = getFirestore(firebaseApp);
  }
  const realtime = config.databaseURL ? getDatabase(firebaseApp) : null;

  const $ = id => document.getElementById(id);
  const show = id => $(id)?.classList.remove('hidden');
  const hide = id => $(id)?.classList.add('hidden');
  const setError = msg => {
    const el = $('cloudAuthError');
    if (!el) return;
    if (!msg) return el.classList.add('hidden');
    el.textContent = msg;
    el.classList.remove('hidden');
  };
  const setVerifyError = msg => {
    const el = $('cloudVerifyError');
    if (!el) return;
    el.textContent = String(msg || '');
    el.classList.toggle('hidden', !msg);
  };
  const showVerificationState = email => {
    gate.classList.remove('hidden');
    hide('cloudAuth'); hide('cloudLoading'); show('cloudVerify');
    if ($('cloudVerifyEmail')) $('cloudVerifyEmail').textContent = String(email || '');
  };
  const friendlyError = err => {
    const code = String(err?.code || '');
    const map = {
      'auth/invalid-credential': 'E-mail ou senha incorretos.',
      'auth/email-already-in-use': 'Esse e-mail já possui uma conta.',
      'auth/weak-password': 'Use uma senha mais forte.',
      'auth/invalid-email': 'Digite um e-mail válido.',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente novamente.',
      'auth/network-request-failed': 'Sem conexão com a internet.'
    };
    return map[code] || err?.message || 'Não foi possível concluir essa ação.';
  };

  function selectTab(tab) {
    document.querySelectorAll('[data-cloud-tab]').forEach(b => b.classList.toggle('active', b.dataset.cloudTab === tab));
    $('cloudLoginForm')?.classList.toggle('hidden', tab !== 'login');
    $('cloudRegisterForm')?.classList.toggle('hidden', tab !== 'register');
    setError('');
  }
  document.querySelectorAll('[data-cloud-tab]').forEach(b => b.addEventListener('click', () => selectTab(b.dataset.cloudTab)));

  $('cloudRegisterForm')?.addEventListener('submit', async e => {
    e.preventDefault(); setError(''); setVerifyError('');
    const name = $('cloudRegisterName').value.trim();
    const email = $('cloudRegisterEmail').value.trim();
    const password = $('cloudRegisterPassword').value;
    let createdUser = null;
    try {
      window.BananaCloudRegistrationInProgress = true;
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      createdUser = credential.user;
      showVerificationState(createdUser.email || email);
      await updateProfile(createdUser, { displayName: name });
      await sendEmailVerification(createdUser);
      showVerificationState(createdUser.email || email);
      // Firestore profile writes happen only after the e-mail is verified.
    } catch (err) {
      const message = friendlyError(err);
      if (createdUser || auth.currentUser) {
        const user = createdUser || auth.currentUser;
        showVerificationState(user?.email || email);
        setVerifyError(`A conta foi criada, mas houve um problema ao concluir o cadastro: ${message}`);
      } else {
        setError(message);
      }
    } finally {
      window.BananaCloudRegistrationInProgress = false;
    }
  });

  $('cloudLoginForm')?.addEventListener('submit', async e => {
    e.preventDefault(); setError('');
    try {
      await signInWithEmailAndPassword(auth, $('cloudLoginEmail').value.trim(), $('cloudLoginPassword').value);
    } catch (err) { setError(friendlyError(err)); }
  });

  $('cloudForgot')?.addEventListener('click', async () => {
    const email = $('cloudLoginEmail').value.trim();
    if (!email) return setError('Digite seu e-mail primeiro.');
    try { await sendPasswordResetEmail(auth, email); setError('E-mail de redefinição enviado.'); }
    catch (err) { setError(friendlyError(err)); }
  });
  $('cloudResend')?.addEventListener('click', async () => {
    try {
      setVerifyError('');
      if (auth.currentUser) await sendEmailVerification(auth.currentUser);
    } catch (err) { setVerifyError(friendlyError(err)); }
  });
  $('cloudVerified')?.addEventListener('click', async () => {
    try {
      setVerifyError('');
      await auth.currentUser?.reload();
      handleUser(auth.currentUser);
    } catch (err) { setVerifyError(friendlyError(err)); }
  });
  $('cloudVerifyLogout')?.addEventListener('click', () => signOut(auth));

  let presenceCleanup = null;
  function attachPresence(user) {
    presenceCleanup?.();
    if (!realtime || !user) return;
    const connectedRef = ref(realtime, '.info/connected');
    const userRef = ref(realtime, `presence/${user.uid}`);
    const off = onValue(connectedRef, snap => {
      if (snap.val() !== true) return;
      onDisconnect(userRef).set({ state: 'offline', lastChanged: rtdbTimestamp() });
      set(userRef, { state: 'online', lastChanged: rtdbTimestamp(), displayName: user.displayName || '' });
    });
    presenceCleanup = () => { try { off(); } catch {} };
  }

  async function ensureProfile(user) {
    await setDoc(doc(db, 'users', user.uid), {
      displayName: user.displayName || user.email?.split('@')[0] || 'Usuário',
      email: user.email || '', emailVerified: !!user.emailVerified,
      lastSeenAt: serverTimestamp(), updatedAt: serverTimestamp()
    }, { merge: true });
  }

  async function handleUser(user) {
    // Always keep one visible auth state until the verified app shell is ready.
    gate.classList.remove('hidden');
    if (!user) {
      hide('cloudVerify'); hide('cloudLoading'); show('cloudAuth');
      window.BananaCloud.ready = false;
      return;
    }
    if (!user.emailVerified) {
      hide('cloudAuth'); hide('cloudLoading');
      showVerificationState(user.email || '');
      window.BananaCloud.ready = false;
      return;
    }
    hide('cloudAuth'); hide('cloudVerify'); show('cloudLoading');
    try { await ensureProfile(user); attachPresence(user); }
    catch (err) { console.error('Banana Cloud profile:', err); }
    hide('cloudLoading'); gate.classList.add('hidden');
    window.BananaCloud.ready = true;
    window.dispatchEvent(new CustomEvent('banana:cloud-ready', { detail: { uid: user.uid, user } }));
  }

  function requireUser() {
    const user = auth.currentUser;
    if (!user?.emailVerified) throw new Error('Faça login com um e-mail verificado.');
    return user;
  }

  async function createServer(name) {
    const user = requireUser();
    const serverRef = doc(collection(db, 'servers'));
    const batch = writeBatch(db);
    batch.set(serverRef, { name: String(name || 'Novo servidor').slice(0, 80), ownerId: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    batch.set(doc(db, 'servers', serverRef.id, 'members', user.uid), { role: 'owner', joinedAt: serverTimestamp(), displayName: user.displayName || '' });
    batch.set(doc(db, 'servers', serverRef.id, 'channels', 'general'), { name: 'geral', type: 'text', position: 0, createdAt: serverTimestamp() });
    batch.set(doc(db, 'users', user.uid, 'serverRefs', serverRef.id), { serverId: serverRef.id, name: String(name || 'Novo servidor').slice(0, 80), role: 'owner', joinedAt: serverTimestamp() });
    await batch.commit();
    return serverRef.id;
  }

  function listenMyServers(callback) {
    const user = requireUser();
    return onSnapshot(query(collection(db, 'users', user.uid, 'serverRefs'), orderBy('joinedAt', 'asc')), snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }

  function listenChannelMessages(serverId, channelId, callback, count = 100) {
    requireUser();
    const q = query(collection(db, 'servers', serverId, 'channels', channelId, 'messages'), orderBy('createdAt', 'desc'), limit(Math.min(200, Math.max(20, count))));
    return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse()));
  }

  async function sendChannelMessage(serverId, channelId, text, extra = {}) {
    const user = requireUser();
    const body = String(text || '').trim().slice(0, 4000);
    if (!body) return;
    return addDoc(collection(db, 'servers', serverId, 'channels', channelId, 'messages'), {
      authorId: user.uid, authorName: user.displayName || '', body,
      replyTo: extra.replyTo || null, createdAt: serverTimestamp(), editedAt: null
    });
  }

  const dmThreadId = (a, b) => [a, b].sort().join('_');
  async function sendDM(otherUid, text) {
    const user = requireUser();
    const body = String(text || '').trim().slice(0, 4000);
    if (!body || !otherUid || otherUid === user.uid) return;
    const threadId = dmThreadId(user.uid, otherUid);
    await setDoc(doc(db, 'dmThreads', threadId), {
      participants: [user.uid, otherUid], updatedAt: serverTimestamp(), lastMessagePreview: body.slice(0, 120)
    }, { merge: true });
    return addDoc(collection(db, 'dmThreads', threadId, 'messages'), {
      authorId: user.uid, body, createdAt: serverTimestamp(), editedAt: null
    });
  }

  function listenDM(otherUid, callback, count = 100) {
    const user = requireUser();
    const threadId = dmThreadId(user.uid, otherUid);
    const q = query(collection(db, 'dmThreads', threadId, 'messages'), orderBy('createdAt', 'desc'), limit(Math.min(200, Math.max(20, count))));
    return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse()));
  }

  async function updateMessage(pathParts, messageId, body) {
    const user = requireUser();
    const refDoc = doc(db, ...pathParts, 'messages', messageId);
    const snap = await getDoc(refDoc);
    if (!snap.exists() || snap.data().authorId !== user.uid) throw new Error('Você só pode editar suas próprias mensagens.');
    await updateDoc(refDoc, { body: String(body || '').trim().slice(0, 4000), editedAt: serverTimestamp() });
  }

  async function deleteMessage(pathParts, messageId) {
    const user = requireUser();
    const refDoc = doc(db, ...pathParts, 'messages', messageId);
    const snap = await getDoc(refDoc);
    if (!snap.exists() || snap.data().authorId !== user.uid) throw new Error('Você só pode apagar suas próprias mensagens.');
    await deleteDoc(refDoc);
  }

  window.BananaCloud = {
    configured: true, ready: false, auth, db, realtime,
    get user() { return auth.currentUser; },
    signOut: () => signOut(auth),
    createServer, listenMyServers, listenChannelMessages, sendChannelMessage,
    sendDM, listenDM, updateMessage, deleteMessage, dmThreadId
  };

  onAuthStateChanged(auth, handleUser);
})();
