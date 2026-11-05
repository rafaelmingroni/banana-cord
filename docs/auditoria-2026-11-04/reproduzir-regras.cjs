// Auditoria local: demonstra o comportamento atual; não testa a produção.
// Execute somente pelos emuladores, conforme RELATORIO.md.
const { createRequire } = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const req = createRequire(path.resolve(__dirname, '../../desktop/package.json'));
// O SDK RTDB Node ignora NO_PROXY. Apenas sockets dos emuladores locais
// devem ir diretamente ao loopback; os proxies externos continuam intactos.
const websocket = req('faye-websocket');
const BaseClient = websocket.Client;
websocket.Client = class LocalEmulatorClient extends BaseClient {
  constructor(url, protocols, options = {}) {
    const local = /^ws:\/\/127\.0\.0\.1:9000\//.test(url);
    const next = { ...options };
    if (local) delete next.proxy;
    super(url, protocols, next);
  }
};
const { initializeTestEnvironment, assertSucceeds, assertFails } = req('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } = req('firebase/firestore');
const { ref, set, get } = req('firebase/database');

async function main() {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_DATABASE_EMULATOR_HOST) {
    throw new Error('Emuladores obrigatórios. Nenhuma operação em produção é permitida.');
  }
  const root = path.resolve(__dirname, '../..');
  const env = await initializeTestEnvironment({
    projectId: 'demo-banana-cord',
    firestore: { rules: fs.readFileSync(path.join(root, 'firebase/firestore.rules'), 'utf8') },
    database: { rules: fs.readFileSync(path.join(root, 'firebase/database.rules.json'), 'utf8') }
  });
  const results = [];
  console.log('Emuladores inicializados; preparando dados sintéticos.');
  const check = async (id, description, action) => {
    await action();
    results.push({ id, description, reproduced: true });
    console.log(`REPRODUZIDO ${id}: ${description}`);
  };
  try {
    await env.clearFirestore();
    await env.clearDatabase();
    const context = uid => env.authenticatedContext(uid, { email_verified: true, email: `${uid}@example.test` });
    const alice = context('alice'), bob = context('bob'), outsider = context('outsider'), mod = context('mod');
    const adb = alice.firestore(), bdb = bob.firestore(), odb = outsider.firestore(), mdb = mod.firestore();
    await env.withSecurityRulesDisabled(async c => {
      const db = c.firestore();
      await setDoc(doc(db, 'relationships', 'alice_bob'), { participants: ['alice', 'bob'], status: 'friends', requestedBy: 'alice' });
      await setDoc(doc(db, 'servers', 's'), { ownerId: 'alice', name: 'Teste' });
      for (const [uid, role] of [['alice', 'owner'], ['bob', 'member'], ['mod', 'moderator']]) {
        await setDoc(doc(db, 'servers', 's', 'members', uid), { role });
      }
      await setDoc(doc(db, 'servers', 's', 'channels', 'chat'), { name: 'chat', type: 'text', allowedRoles: [] });
      await setDoc(doc(db, 'servers', 's', 'channels', 'chat', 'messages', 'm'), { authorId: 'alice', text: 'Original', createdAt: new Date(), reactions: {} });
      await set(ref(c.database(), 'sessionOwners/victim-session'), 'alice');
      await set(ref(c.database(), 'signals/victim-session/existing'), { data: { description: { sdp: 'SDP sintético' } }, fromUserId: 'bob' });
    });
    await check('A01', 'getDoc de DM inexistente é negado até para amigos (caminho usado pelo reparo 3.1.2)', () =>
      assertFails(getDoc(doc(adb, 'dmThreads', 'alice_bob'))));
    await check('A02', 'criar diretamente o pai da DM funciona para os mesmos amigos', () =>
      assertSucceeds(setDoc(doc(adb, 'dmThreads', 'alice_bob'), { participants: ['alice', 'bob'], updatedAt: serverTimestamp() })));
    await check('A03', 'terceiro verificado pode tomar sessionOwners de outra conta', () =>
      assertSucceeds(set(ref(outsider.database(), 'sessionOwners/victim-session'), 'outsider')));
    await check('A04', 'depois da tomada, terceiro lê a caixa de sinalização da vítima', () =>
      assertSucceeds(get(ref(outsider.database(), 'signals/victim-session'))));
    const entry = uid => ({ userId: uid, user: { id: uid, name: uid }, mediaState: { muted: false, camera: false, screen: false }, speaking: false });
    await check('A05', 'terceiro sem associação entra em sala RTDB de uma comunidade', () =>
      assertSucceeds(set(ref(outsider.database(), 'voiceRooms/s/voice/attacker-session'), entry('outsider'))));
    await check('A06', 'qualquer verificado lê participantes de uma sala conhecida', () =>
      assertSucceeds(get(ref(outsider.database(), 'voiceRooms/s'))));
    await check('A07', 'registro de voz de outro usuário pode ser sobrescrito', () =>
      assertSucceeds(set(ref(bob.database(), 'voiceRooms/s/voice/attacker-session'), entry('bob'))));
    await check('A08', 'sinal com fromSocketId de terceiro é aceito sem prova de sessão ou sala', () =>
      assertSucceeds(set(ref(bob.database(), 'signals/victim-session/forged'), { fromUserId: 'bob', fromSocketId: 'socket-de-outro', data: { description: { type: 'offer', sdp: 'sintético' } } })));
    await check('A09', 'membro pode atribuir reações a outras contas e usar emoji arbitrário', () =>
      assertSucceeds(updateDoc(doc(bdb, 'servers', 's', 'channels', 'chat', 'messages', 'm'), { reactions: { falso: ['alice', 'mod', 'conta-inventada'] } })));
    await check('A10', 'moderador altera texto do autor apesar da restrição da interface', () =>
      assertSucceeds(updateDoc(doc(mdb, 'servers', 's', 'channels', 'chat', 'messages', 'm'), { text: 'Alterado por moderador', editedAt: serverTimestamp() })));
    await check('A11', 'mensagem aceita createdAt arbitrário no futuro', () =>
      assertSucceeds(setDoc(doc(bdb, 'servers', 's', 'channels', 'chat', 'messages', 'future'), { authorId: 'bob', text: 'Futuro', createdAt: new Date('2099-01-01') })));
    await assertSucceeds(updateDoc(doc(adb, 'relationships', 'alice_bob'), { status: 'blocked', blockedBy: 'alice' }));
    await check('A12', 'usuário bloqueado apaga o bloqueio aplicado pelo outro', () =>
      assertSucceeds(deleteDoc(doc(bdb, 'relationships', 'alice_bob'))));
    await check('A13', 'usuário bloqueado recria pedido após apagar bloqueio', () =>
      assertSucceeds(setDoc(doc(bdb, 'relationships', 'alice_bob'), { participants: ['alice', 'bob'], status: 'pending', requestedBy: 'bob' })));
    await check('A14', 'dono pode remover a própria associação por acesso direto', () =>
      assertSucceeds(deleteDoc(doc(adb, 'servers', 's', 'members', 'alice'))));
    await check('A15', 'após perder associação, dono fica sem permissão para remover canais', () =>
      assertFails(deleteDoc(doc(adb, 'servers', 's', 'channels', 'chat'))));
    fs.writeFileSync(path.join(__dirname, 'resultado-regras.json'), JSON.stringify({ project: 'demo-banana-cord', results }, null, 2) + '\n');
  } finally { await env.cleanup(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
