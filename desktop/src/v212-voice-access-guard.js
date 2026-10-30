/* Banana Cord V2.0.12 — final client-side voice access guard. */
(() => {
  if (window.__bananaV212VoiceAccessGuard) return;
  window.__bananaV212VoiceAccessGuard = true;

  const ranks = { member: 0, moderator: 1, admin: 2, owner: 3 };
  const labels = { member: 'Membro', moderator: 'Moderador', admin: 'Administrador', owner: 'Dono' };
  const privateServerId = '__private__';

  function minimumRole(channel) {
    const roles = [...new Set((channel?.allowedRoles || []).filter(role => ['member', 'moderator', 'admin'].includes(role)))];
    if (!roles.length) return null;
    return roles.sort((a, b) => ranks[a] - ranks[b])[0];
  }

  function roleIn(server) {
    if (!server || !state.user?.id) return 'member';
    if (server.ownerId === state.user.id) return 'owner';
    return server.memberRoles?.[state.user.id] || 'member';
  }

  function allowed(server, channel) {
    const minimum = minimumRole(channel);
    return !minimum || ranks[roleIn(server)] >= ranks[minimum];
  }

  if (typeof joinVoice === 'function') {
    const previousJoinVoice = joinVoice;
    joinVoice = async function joinVoiceV212Guard(channel) {
      const server = state.selectedServer;
      if (channel?.type === 'voice' && server && !allowed(server, channel)) {
        const minimum = minimumRole(channel);
        toast(`Este canal exige cargo ${labels[minimum] || minimum} ou superior.`, 3600);
        return false;
      }
      return previousJoinVoice(channel);
    };
  }

  if (typeof renderChannels === 'function') {
    const previousRenderChannels = renderChannels;
    renderChannels = function renderChannelsV212Guard(...args) {
      const result = previousRenderChannels(...args);
      const serverId = state.voice?.serverId;
      const channelId = state.voice?.channelId;
      if (!serverId || !channelId || serverId === privateServerId) return result;
      const server = state.servers?.find(item => item.id === serverId);
      if (!server) return result;
      const channel = server.channels?.find(item => item.id === channelId && item.type === 'voice');
      if (!channel || !allowed(server, channel)) {
        leaveVoice();
        toast('Você saiu da call porque seu cargo não permite mais acessar esse canal.', 4200);
      }
      return result;
    };
  }
})();
