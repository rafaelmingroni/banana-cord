# Mingrx 3.0.0 — o maior lançamento do projeto

Mingrx é a nova identidade pública do aplicativo que começou como Banana Cord. Esta versão não é apenas uma troca de nome: ela consolida a experiência Cloud, redesenha a interface e prepara o projeto para crescer com atualizações frequentes após o lançamento.

## Banana Cord agora é Mingrx

- Nova marca, logo, paleta e identidade visual Mingrx.
- Novo instalador e atalhos com o nome Mingrx.
- Novo protocolo `mingrx://` para convites.
- Compatibilidade temporária com `bananacord://` para não quebrar links antigos.
- Atualização no mesmo aplicativo para usuários existentes, preservando dados locais e configurações.
- Aviso especial de migração no primeiro início após atualizar da linha anterior.

## Comunidades

- Comunidades persistentes na nuvem.
- Foto personalizada de comunidade.
- Fotos grandes são redimensionadas e compactadas automaticamente; o usuário não precisa preparar um arquivo pequeno antes.
- Correção do caminho antigo que limitava fotos a aproximadamente 550 KB.
- Convites permanentes e temporários com modal novo e proteção contra freeze.
- Categorias, canais, cargos e permissões.

## Chat e imagens

- Envio de imagens/prints em canais de comunidade e mensagens privadas.
- Ctrl+V para colar screenshots diretamente no chat.
- Compressão automática antes do upload.
- Visualização inline e lightbox.
- Firebase Storage integrado à mesma instância Firebase usada pelo Mingrx Cloud, eliminando o erro `No Firebase App '[DEFAULT]'` causado por runtimes separados.
- DMs continuam usando a camada de criptografia ponta a ponta existente.

## Interface

- Shell Mingrx mais limpo e responsivo.
- Área privada redesenhada.
- Friends, Requests e Add Friend integrados à nova identidade.
- Temas Sistema, Midnight, Pearl, Crimson, Ocean, Forest e Mono.
- Layout validado de 980 px até ultrawide 3440 px.
- Membros em drawer contextual, sem reservar uma coluna fantasma.

## Voz, câmera e tela

- Voz WebRTC para grupos pequenos.
- Chamada privada 1:1.
- Webcam e compartilhamento de tela.
- Perfis de qualidade/FPS e controles de áudio.
- Diagnóstico e indicadores de conexão.
- Prévia local protegida durante screen share para reduzir recursão e uso de GPU.

## Segurança e distribuição

- Regras de Firestore, Realtime Database e Storage validadas em emuladores antes da publicação.
- Upload de mídia restrito a contas verificadas e tipos de imagem permitidos.
- Chaves privadas E2EE permanecem no dispositivo.
- Build oficial publica EXE, blockmap e `latest.yml` para atualização automática.
- O repositório técnico mantém temporariamente o slug antigo para que instalações existentes encontrem a atualização 3.0 sem intervenção manual.

Obrigado a quem acompanhou a evolução desde as primeiras versões. A partir daqui, o nome é **Mingrx**.