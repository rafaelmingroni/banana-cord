/* Banana Cord 2.1 — lightweight live localization for pt-BR, en-US and es-ES. */
(() => {
  if (window.BananaI18n) return;

  const SUPPORTED = ['pt-BR', 'en-US', 'es-ES'];
  const DICT = {
    'pt-BR': {
      'settings.social': 'Idioma e Social',
      'settings.socialSub': 'Idioma, inicialização, presença e atividade',
      'language.title': 'Idioma do Banana Cord',
      'language.help': 'A interface muda na hora e a preferência fica salva neste computador.',
      'startup.title': 'Iniciar com o Windows',
      'startup.help': 'Abre o Banana Cord minimizado quando você entra no Windows.',
      'away.title': 'Ausente automático',
      'away.help': 'Muda para Ausente quando o computador fica sem atividade e volta para Online quando você retorna.',
      'activity.title': 'Status de atividade',
      'activity.help': 'Mostra aos seus amigos quando um jogo reconhecido está aberto. O Banana Cord não publica sua lista de processos.',
      'activity.none': 'Nenhum jogo reconhecido agora',
      'activity.playing': 'Jogando {game}',
      'activity.for': 'há {time}',
      'save': 'Salvar alterações',
      'saved': 'Configurações salvas.',
      'channels': 'Canais',
      'create.text': 'Canal de texto',
      'create.textSub': 'Conversas e mensagens',
      'create.voice': 'Canal de voz',
      'create.voiceSub': 'Voz e compartilhamento',
      'create.category': 'Categoria',
      'create.categorySub': 'Organize seus canais',
      'noCategory': 'Sem categoria',
      'rename': 'Renomear',
      'move': 'Mover',
      'delete': 'Excluir',
      'edit': 'Editar',
      'reply': 'Responder',
      'more': 'Mais',
      'edited': '(editada)',
      'cancel': 'Cancelar',
      'confirm': 'Confirmar',
      'deleteMessage.title': 'Excluir mensagem?',
      'deleteMessage.body': 'Essa mensagem será removida para todos nesta conversa.',
      'commands.title': 'Comandos do Banana Cord',
      'commands.clear': 'Limpa mensagens conforme sua permissão.',
      'commands.help': 'Mostra os comandos disponíveis.',
      'commands.call': 'Inicia ou atende uma chamada privada.',
      'commands.mute': 'Muta ou desmuta seu microfone.',
      'commands.deafen': 'Ativa ou desativa ensurdecer.',
      'commands.status': 'Altera seu status.',
      'clear.confirmTitle': 'Limpar mensagens?',
      'clear.confirmBody': 'Essa ação apaga as mensagens selecionadas e não pode ser desfeita.',
      'clear.done': '{count} mensagem(ns) removida(s).',
      'role.member': 'Membro',
      'role.memberSub': 'Acesso normal ao servidor',
      'role.moderator': 'Moderador',
      'role.moderatorSub': 'Organiza canais e modera mensagens',
      'role.admin': 'Administrador',
      'role.adminSub': 'Gerencia servidor, canais e membros',
      'status.online': 'Online',
      'status.away': 'Ausente',
      'status.busy': 'Ocupado'
    },
    'en-US': {
      'settings.social': 'Language & Social',
      'settings.socialSub': 'Language, startup, presence and activity',
      'language.title': 'Banana Cord language',
      'language.help': 'The interface changes instantly and the preference is saved on this computer.',
      'startup.title': 'Start with Windows',
      'startup.help': 'Starts Banana Cord minimized when you sign in to Windows.',
      'away.title': 'Automatic idle status',
      'away.help': 'Switches to Away when the computer is inactive and returns to Online when you come back.',
      'activity.title': 'Activity status',
      'activity.help': 'Shows your friends when a recognized game is running. Banana Cord never publishes your process list.',
      'activity.none': 'No recognized game right now',
      'activity.playing': 'Playing {game}',
      'activity.for': 'for {time}',
      'save': 'Save changes',
      'saved': 'Settings saved.',
      'channels': 'Channels',
      'create.text': 'Text channel',
      'create.textSub': 'Conversations and messages',
      'create.voice': 'Voice channel',
      'create.voiceSub': 'Voice and screen sharing',
      'create.category': 'Category',
      'create.categorySub': 'Organize your channels',
      'noCategory': 'No category',
      'rename': 'Rename',
      'move': 'Move',
      'delete': 'Delete',
      'edit': 'Edit',
      'reply': 'Reply',
      'more': 'More',
      'edited': '(edited)',
      'cancel': 'Cancel',
      'confirm': 'Confirm',
      'deleteMessage.title': 'Delete message?',
      'deleteMessage.body': 'This message will be removed for everyone in this conversation.',
      'commands.title': 'Banana Cord commands',
      'commands.clear': 'Clears messages according to your permissions.',
      'commands.help': 'Shows the available commands.',
      'commands.call': 'Starts or answers a private call.',
      'commands.mute': 'Mutes or unmutes your microphone.',
      'commands.deafen': 'Toggles deafen.',
      'commands.status': 'Changes your status.',
      'clear.confirmTitle': 'Clear messages?',
      'clear.confirmBody': 'This deletes the selected messages and cannot be undone.',
      'clear.done': '{count} message(s) removed.',
      'role.member': 'Member',
      'role.memberSub': 'Normal server access',
      'role.moderator': 'Moderator',
      'role.moderatorSub': 'Organizes channels and moderates messages',
      'role.admin': 'Administrator',
      'role.adminSub': 'Manages server, channels and members',
      'status.online': 'Online',
      'status.away': 'Away',
      'status.busy': 'Busy'
    },
    'es-ES': {
      'settings.social': 'Idioma y Social',
      'settings.socialSub': 'Idioma, inicio, presencia y actividad',
      'language.title': 'Idioma de Banana Cord',
      'language.help': 'La interfaz cambia al instante y la preferencia queda guardada en este ordenador.',
      'startup.title': 'Iniciar con Windows',
      'startup.help': 'Abre Banana Cord minimizado cuando inicias sesión en Windows.',
      'away.title': 'Ausente automático',
      'away.help': 'Cambia a Ausente cuando el ordenador está inactivo y vuelve a En línea cuando regresas.',
      'activity.title': 'Estado de actividad',
      'activity.help': 'Muestra a tus amigos cuando hay un juego reconocido abierto. Banana Cord nunca publica tu lista de procesos.',
      'activity.none': 'Ningún juego reconocido ahora',
      'activity.playing': 'Jugando {game}',
      'activity.for': 'desde hace {time}',
      'save': 'Guardar cambios',
      'saved': 'Configuración guardada.',
      'channels': 'Canales',
      'create.text': 'Canal de texto',
      'create.textSub': 'Conversaciones y mensajes',
      'create.voice': 'Canal de voz',
      'create.voiceSub': 'Voz y compartir pantalla',
      'create.category': 'Categoría',
      'create.categorySub': 'Organiza tus canales',
      'noCategory': 'Sin categoría',
      'rename': 'Renombrar',
      'move': 'Mover',
      'delete': 'Eliminar',
      'edit': 'Editar',
      'reply': 'Responder',
      'more': 'Más',
      'edited': '(editado)',
      'cancel': 'Cancelar',
      'confirm': 'Confirmar',
      'deleteMessage.title': '¿Eliminar mensaje?',
      'deleteMessage.body': 'Este mensaje se eliminará para todos en esta conversación.',
      'commands.title': 'Comandos de Banana Cord',
      'commands.clear': 'Limpia mensajes según tus permisos.',
      'commands.help': 'Muestra los comandos disponibles.',
      'commands.call': 'Inicia o atiende una llamada privada.',
      'commands.mute': 'Silencia o activa tu micrófono.',
      'commands.deafen': 'Activa o desactiva ensordecer.',
      'commands.status': 'Cambia tu estado.',
      'clear.confirmTitle': '¿Limpiar mensajes?',
      'clear.confirmBody': 'Esta acción elimina los mensajes seleccionados y no se puede deshacer.',
      'clear.done': '{count} mensaje(s) eliminado(s).',
      'role.member': 'Miembro',
      'role.memberSub': 'Acceso normal al servidor',
      'role.moderator': 'Moderador',
      'role.moderatorSub': 'Organiza canales y modera mensajes',
      'role.admin': 'Administrador',
      'role.adminSub': 'Gestiona servidor, canales y miembros',
      'status.online': 'En línea',
      'status.away': 'Ausente',
      'status.busy': 'Ocupado'
    }
  };

  const LITERALS = [
    ['Encontrar amigos','Find friends','Encontrar amigos'],
    ['Sua primeira conversa começa aqui.','Your first conversation starts here.','Tu primera conversación empieza aquí.'],
    ['Continue suas conversas.','Continue your conversations.','Continúa tus conversaciones.'],
    ['Suas pessoas, por perto.','Your people, close by.','Tu gente, cerca de ti.'],
    ['SEU PRIVADO','YOUR PRIVATE SPACE','TU ESPACIO PRIVADO'],
    ['CONVERSAS RECENTES','RECENT CONVERSATIONS','CONVERSACIONES RECIENTES'],
    ['PRONTOS PARA CONVERSAR','READY TO CHAT','LISTOS PARA CONVERSAR'],
    ['Encontre um amigo para trocar mensagens e fazer chamadas, só entre vocês.','Find a friend to exchange messages and make private calls.','Encuentra un amigo para intercambiar mensajes y hacer llamadas privadas.'],
    ['Abra uma conversa abaixo ou encontre mais amigos no Mingrx.','Open a conversation below or find more friends on Mingrx.','Abre una conversación abajo o encuentra más amigos en Mingrx.'],
    ['As conversas que você iniciar ficam na lateral. É fácil voltar quando quiser.','Your conversations stay in the sidebar, ready whenever you return.','Tus conversaciones quedan en la barra lateral para volver cuando quieras.'],
    ['Mensagens e chamadas, no seu ritmo.','Messages and calls, at your pace.','Mensajes y llamadas, a tu ritmo.'],
    ['Mensagens privadas','Private messages','Mensajes privados'],
    ['Criar ou entrar em servidor','Create or join a server','Crear o unirse a un servidor'],
    ['Convidar','Invite','Invitar'],
    ['Configurações do servidor','Server settings','Configuración del servidor'],
    ['Voz conectada','Voice connected','Voz conectada'],
    ['Microfone','Microphone','Micrófono'],
    ['Ensurdecer','Deafen','Ensordecer'],
    ['Câmera','Camera','Cámara'],
    ['Compartilhar tela','Share screen','Compartir pantalla'],
    ['Sair','Leave','Salir'],
    ['Perfil e configurações','Profile and settings','Perfil y configuración'],
    ['Conversa do servidor','Server conversation','Conversación del servidor'],
    ['conectado','connected','conectado'],
    ['Crie ou entre em um servidor pelo botão +.','Create or join a server using the + button.','Crea o únete a un servidor con el botón +.'],
    ['Mensagem','Message','Mensaje'],
    ['Enviar','Send','Enviar'],
    ['Sala de voz','Voice room','Sala de voz'],
    ['Conecte-se para conversar.','Connect to talk.','Conéctate para hablar.'],
    ['Reconectar','Reconnect','Reconectar'],
    ['Entrar na voz','Join voice','Entrar a voz'],
    ['Membros','Members','Miembros'],
    ['Privado','Private','Privado'],
    ['Amigos','Friends','Amigos'],
    ['Adicionar amigo','Add friend','Agregar amigo'],
    ['Recentes','Recent','Recientes'],
    ['Mensagem privada','Private message','Mensaje privado'],
    ['Converse diretamente com seus amigos','Talk directly with your friends','Habla directamente con tus amigos'],
    ['Comece a conversa 👋','Start the conversation 👋','Empieza la conversación 👋'],
    ['Configurações','Settings','Configuración'],
    ['Perfil','Profile','Perfil'],
    ['Áudio','Audio','Audio'],
    ['Vídeo e tela','Video & screen','Vídeo y pantalla'],
    ['Geral','General','General'],
    ['Diagnóstico','Diagnostics','Diagnóstico'],
    ['Atualizações','Updates','Actualizaciones'],
    ['Seu perfil','Your profile','Tu perfil'],
    ['Nome','Name','Nombre'],
    ['Status','Status','Estado'],
    ['Online','Online','En línea'],
    ['Ocupado','Busy','Ocupado'],
    ['Ausente','Away','Ausente'],
    ['Foto de perfil','Profile picture','Foto de perfil'],
    ['Salvar perfil','Save profile','Guardar perfil'],
    ['Desconectar','Disconnect','Desconectar'],
    ['Dispositivo de entrada','Input device','Dispositivo de entrada'],
    ['Teste do microfone','Microphone test','Prueba de micrófono'],
    ['Gravar teste','Record test','Grabar prueba'],
    ['Tratamento de voz','Voice processing','Procesamiento de voz'],
    ['Cancelamento de eco','Echo cancellation','Cancelación de eco'],
    ['Redução de ruído','Noise suppression','Reducción de ruido'],
    ['Ganho automático','Automatic gain','Ganancia automática'],
    ['Entrar mutado','Join muted','Entrar silenciado'],
    ['Fone / alto-falante','Headphones / speakers','Auriculares / altavoces'],
    ['Volume geral','Master volume','Volumen general'],
    ['Testar saída','Test output','Probar salida'],
    ['Atualizar dispositivos','Refresh devices','Actualizar dispositivos'],
    ['Salvar áudio','Save audio','Guardar audio'],
    ['Qualidade','Quality','Calidad'],
    ['Compartilhamento','Screen sharing','Compartir pantalla'],
    ['Automático (recomendado)','Automatic (recommended)','Automático (recomendado)'],
    ['Fluidez','Smoothness','Fluidez'],
    ['Economia de banda','Bandwidth saver','Ahorro de ancho de banda'],
    ['Salvar vídeo e tela','Save video & screen','Guardar vídeo y pantalla'],
    ['Comportamento','Behavior','Comportamiento'],
    ['Sons de entrada/saída','Join/leave sounds','Sonidos de entrada/salida'],
    ['Push-to-talk','Push-to-talk','Pulsar para hablar'],
    ['Tecla do push-to-talk','Push-to-talk key','Tecla de pulsar para hablar'],
    ['Salvar geral','Save general','Guardar general'],
    ['Diagnóstico da chamada','Call diagnostics','Diagnóstico de llamada'],
    ['Verificar agora','Check now','Comprobar ahora'],
    ['Baixar','Download','Descargar'],
    ['Salvar','Save','Guardar'],
    ['Dono','Owner','Propietario'],
    ['Administrador','Administrator','Administrador'],
    ['Moderador','Moderator','Moderador'],
    ['Membro','Member','Miembro'],
    ['Offline','Offline','Desconectado'],
    ['Carregando mensagens anteriores…','Loading older messages…','Cargando mensajes anteriores…'],
    ['Mensagens protegidas com criptografia ponta a ponta','Messages protected with end-to-end encryption','Mensajes protegidos con cifrado de extremo a extremo'],
    ['Só você e seu contato conseguem ler as novas mensagens desta conversa.','Only you and your contact can read new messages in this conversation.','Solo tú y tu contacto pueden leer los mensajes nuevos de esta conversación.']
  ].map(([pt,en,es]) => ({ 'pt-BR':pt, 'en-US':en, 'es-ES':es }));

  const PROTECTED = '.msg-text,.msg-head b,.invite-box,.settings-url,#serverName,#channelName,#myName,.voice-user-name,.v219-member-name b,.v219-role-user b,.v219-profile-heading h2,.dm-row b,.v1-friend-quick-row b,.channel,.v21-category-name,input,textarea,code,pre';

  function normalizeLocale(value) {
    const raw = String(value || '').toLowerCase();
    if (raw.startsWith('en')) return 'en-US';
    if (raw.startsWith('es')) return 'es-ES';
    return 'pt-BR';
  }

  function initialLocale() {
    const saved = localStorage.getItem('banana.language');
    if (saved && SUPPORTED.includes(saved)) return saved;
    for (const candidate of navigator.languages || [navigator.language]) {
      const normalized = normalizeLocale(candidate);
      if (SUPPORTED.includes(normalized)) return normalized;
    }
    return 'pt-BR';
  }

  let locale = initialLocale();

  function t(key, vars = {}) {
    let text = DICT[locale]?.[key] || DICT['pt-BR'][key] || key;
    for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(value));
    return text;
  }

  function translateLiteral(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) return value;
    for (const group of LITERALS) {
      if (Object.values(group).includes(trimmed)) {
        const leading = String(value).match(/^\s*/)?.[0] || '';
        const trailing = String(value).match(/\s*$/)?.[0] || '';
        return leading + group[locale] + trailing;
      }
    }
    return value;
  }

  function protectedNode(node) {
    const parent = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    return !!parent?.closest?.(PROTECTED);
  }

  function translateElement(root = document.body) {
    if (!root || protectedNode(root)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (protectedNode(node)) continue;
      const next = translateLiteral(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    }
    const elements = root.nodeType === Node.ELEMENT_NODE ? [root, ...root.querySelectorAll('*')] : [];
    for (const el of elements) {
      if (protectedNode(el)) continue;
      for (const attr of ['title','placeholder','aria-label']) {
        const value = el.getAttribute?.(attr);
        if (!value) continue;
        const next = translateLiteral(value);
        if (next !== value) el.setAttribute(attr, next);
      }
    }
  }

  function setLocale(next) {
    locale = SUPPORTED.includes(next) ? next : normalizeLocale(next);
    localStorage.setItem('banana.language', locale);
    document.documentElement.lang = locale;
    translateElement(document.body);
    window.dispatchEvent(new CustomEvent('banana:i18n-changed', { detail: { locale } }));
    return locale;
  }

  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes || []) {
        if (node.nodeType === Node.TEXT_NODE && !protectedNode(node)) {
          const next = translateLiteral(node.nodeValue);
          if (next !== node.nodeValue) node.nodeValue = next;
        } else if (node.nodeType === Node.ELEMENT_NODE) translateElement(node);
      }
    }
  });

  window.BananaI18n = { t, setLocale, getLocale: () => locale, supported: [...SUPPORTED], translateElement };
  document.documentElement.lang = locale;
  queueMicrotask(() => {
    translateElement(document.body);
    observer.observe(document.body, { childList:true, subtree:true });
  });
})();
