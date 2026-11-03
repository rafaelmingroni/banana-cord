# Mingrx 3.1.3 — Obsidian

Atualização visual do Mingrx para Windows, com foco nas áreas sociais e na Central de Configurações, preservando a compatibilidade com as contas, mensagens e o atualizador das versões anteriores.

## Novidades

- **Espaço Privado:** navegação mais clara entre mensagens privadas, amigos e adicionar amigo, com estados de presença e hierarquia visual refinados.
- **Central de Amigos:** organização e ações visuais mais consistentes, com ícones vetoriais e melhor comportamento responsivo.
- **Configurações:** nova interface Obsidian com navegação simplificada, busca por categorias (Ctrl/Cmd+F), visual padronizado para perfil, áudio, vídeo, atalhos, diagnóstico e atualizações.
- **Identidade Mingrx:** acabamento escuro com acentos violetas, tipografia e estados de foco mais consistentes.
- **Acessibilidade e performance:** suporte a preferências de movimento reduzido e observadores visuais limitados às áreas relevantes do app.

## Compatibilidade e segurança

- Mantém o appId `com.bananacord.app` para preservar a continuidade das atualizações automáticas.
- Não modifica os protocolos de chat, chamadas, compartilhamento de tela, persistência de mensagens nem o escopo da criptografia ponta a ponta.
- A correção da rolagem interna de Configurações foi validada na suíte Electron.

## Instalação

Quem já utiliza o Mingrx deve receber a atualização pelo atualizador do aplicativo após a publicação de `v3.1.3`. O instalador Windows também estará disponível nos assets desta versão.

## Validação

A integração visual passou pelos testes de JavaScript, regressões Cloud/UI, regras Firebase, testes de interação Electron e CodeQL na PR #31. O workflow oficial de release fará novamente as verificações antes de publicar o instalador e os metadados de atualização.
