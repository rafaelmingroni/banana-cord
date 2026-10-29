const os = require('os');
const fs = require('fs');
const path = require('path');
const { io } = require('socket.io-client');
const { startBananaServer } = require('../server/server');

const timeoutMs = 6000;
function once(socket, event, predicate = () => true, timeout = timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(event, handler); reject(new Error(`Timeout esperando ${event}`)); }, timeout);
    const handler = data => {
      try {
        if (!predicate(data)) return;
        clearTimeout(timer); socket.off(event, handler); resolve(data);
      } catch (e) { clearTimeout(timer); socket.off(event, handler); reject(e); }
    };
    socket.on(event, handler);
  });
}
function assert(condition, message) { if (!condition) throw new Error(message); }

(async () => {
  const dataFile = path.join(os.tmpdir(), `banana-v1-smoke-${process.pid}-${Date.now()}.json`);
  const handle = await startBananaServer({ port: 0, dataFile });
  const port = handle.server.address().port;
  const url = `http://127.0.0.1:${port}`;
  const a = io(url, { transports: ['websocket'], forceNew: true });
  const b = io(url, { transports: ['websocket'], forceNew: true });
  try {
    await Promise.all([once(a, 'connect'), once(b, 'connect')]);

    const readyAP = once(a, 'auth:ready');
    a.emit('auth:hello', { deviceId: 'smoke-a', name: 'Rafa', status: 'online' });
    const readyA = await readyAP; assert(readyA.user.name === 'Rafa', 'auth A falhou');

    const readyBP = once(b, 'auth:ready');
    b.emit('auth:hello', { deviceId: 'smoke-b', name: 'Bia', status: 'online' });
    await readyBP;

    const createdP = once(a, 'server:created');
    a.emit('server:create', { name: 'Banana V1 Smoke' });
    const server = await createdP; assert(server.name === 'Banana V1 Smoke', 'server:create falhou');
    const general = server.channels.find(c => c.type === 'text'); assert(general, 'canal geral ausente');

    const joinedP = once(b, 'server:joined');
    b.emit('server:join', { inviteCode: server.inviteCode });
    await joinedP;

    const requestP = once(b, 'social:state', s => s.incoming?.some(u => u.id === 'smoke-a'));
    a.emit('friend:request', { userId: 'smoke-b' });
    await requestP;
    const friendP = once(a, 'social:state', s => s.friends?.some(u => u.id === 'smoke-b'));
    b.emit('friend:accept', { userId: 'smoke-a' });
    await friendP;

    const newMsgP = once(b, 'message:new', m => m.text === 'Olá @Bia');
    a.emit('message:send', { serverId: server.id, channelId: general.id, text: 'Olá @Bia' });
    const msg = await newMsgP;
    assert(msg.mentionIds.includes('smoke-b'), '@menção não foi registrada');

    const editedP = once(b, 'message:updated', m => m.id === msg.id && m.text === 'Olá editado');
    a.emit('message:edit', { serverId: server.id, channelId: general.id, messageId: msg.id, text: 'Olá editado' });
    const edited = await editedP; assert(edited.editedAt, 'editedAt ausente');

    const reactP = once(b, 'message:updated', m => m.id === msg.id && m.reactions?.['👍']?.includes('smoke-b'));
    b.emit('message:react', { serverId: server.id, channelId: general.id, messageId: msg.id, emoji: '👍' });
    await reactP;

    const replyP = once(b, 'message:new', m => m.replyToId === msg.id);
    a.emit('message:send', { serverId: server.id, channelId: general.id, text: 'Resposta', replyToId: msg.id });
    await replyP;

    const deletedP = once(b, 'message:deleted', d => d.messageId === msg.id);
    a.emit('message:delete', { serverId: server.id, channelId: general.id, messageId: msg.id });
    await deletedP;

    const catP = once(a, 'server:updated', s => s.categories?.some(c => c.name === 'PRIVADO'));
    a.emit('category:create', { serverId: server.id, name: 'PRIVADO' });
    const withCat = await catP; const cat = withCat.categories.find(c => c.name === 'PRIVADO');

    const ownerSecretP = once(a, 'server:updated', s => s.channels?.some(c => c.name === 'staff'));
    const memberFilteredP = once(b, 'server:updated', s => !s.channels?.some(c => c.name === 'staff'));
    a.emit('channel:create', { serverId: server.id, type: 'text', name: 'staff', categoryId: cat.id, allowedRoles: ['moderator'] });
    const [ownerSecret] = await Promise.all([ownerSecretP, memberFilteredP]);
    const secret = ownerSecret.channels.find(c => c.name === 'staff'); assert(secret, 'canal privado não criado');

    const roleVisibleP = once(b, 'server:updated', s => s.channels?.some(c => c.id === secret.id));
    a.emit('member:set-role', { serverId: server.id, userId: 'smoke-b', role: 'moderator' });
    await roleVisibleP;

    const dmP = once(b, 'dm:new', x => x.message?.text === 'DM teste');
    a.emit('dm:send', { userId: 'smoke-b', text: 'DM teste' });
    const dm = (await dmP).message;
    const dmEditP = once(b, 'dm:updated', x => x.message?.id === dm.id && x.message.text === 'DM editada');
    a.emit('dm:edit', { userId: 'smoke-b', messageId: dm.id, text: 'DM editada' });
    await dmEditP;
    const dmDeleteP = once(b, 'dm:deleted', x => x.messageId === dm.id);
    a.emit('dm:delete', { userId: 'smoke-b', messageId: dm.id });
    await dmDeleteP;

    const customP = once(b, 'presence:update', u => u.id === 'smoke-a' && u.customStatus === 'Jogando');
    a.emit('profile:update', { customStatus: 'Jogando' });
    await customP;

    const iconP = once(b, 'server:updated', s => s.id === server.id && s.icon === 'data:image/png;base64,AA==');
    a.emit('server:update', { serverId: server.id, icon: 'data:image/png;base64,AA==' });
    await iconP;

    const removedP = once(b, 'server:removed', x => x.serverId === server.id && x.deleted);
    a.emit('server:delete', { serverId: server.id });
    await removedP;

    console.log('Banana Cord v1 smoke test: OK');
  } finally {
    a.disconnect(); b.disconnect(); await handle.close();
    try { fs.unlinkSync(dataFile); } catch {}
  }
})().catch(err => { console.error(err); process.exit(1); });
