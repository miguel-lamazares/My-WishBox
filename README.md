# My-WishBox

Bot pessoal de wishlist no WhatsApp. Você conversa com o bot no próprio WhatsApp e ele guarda, organiza e consulta a sua lista de desejos em um PostgreSQL — com preço, categoria, prioridade, link, imagem, orçamento e histórico de compras.

Feito em TypeScript com [Baileys](https://github.com/WhiskeySockets/Baileys) (WhatsApp Web, sem API oficial), `pg` e `pino`.

---

## Índice

- [Recursos](#recursos)
- [Como funciona](#como-funciona)
- [Requisitos](#requisitos)
- [Instalação](#instalação)
- [Banco de dados](#banco-de-dados)
- [Configuração (.env)](#configuração-env)
- [Rodando](#rodando)
- [Docker](#docker)
- [Comandos](#comandos)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Segurança](#segurança)
- [Licença](#licença)

---

## Recursos

- Cadastro guiado de itens (pergunta nome, preço, link, imagem, categoria, prioridade e nota, um passo por vez)
- Edição item por item, sem precisar recadastrar
- Categorias, prioridades (1 a 4) e marcação de comprado / não comprado
- Busca por termo, listagem por categoria, item aleatório e resumo com totais
- Orçamento pessoal e comparação com o valor da lista
- `!undo` para desfazer a última alteração destrutiva
- Restrição de acesso por número (JID), para o bot responder só a você
- Sessão do WhatsApp persistida em disco (escaneia o QR uma vez só)
- Deploy pronto em Docker / Docker Compose

## Como funciona

1. O bot sobe uma sessão do WhatsApp Web via Baileys e imprime um QR Code no terminal.
2. Você escaneia com o celular; as credenciais ficam salvas em `AUTH_DIR` (padrão `auth_info`).
3. Toda mensagem privada recebida passa pelo roteador de comandos (`COMMAND_PREFIX`, padrão `!`).
4. Os dados ficam no PostgreSQL, em duas tabelas: `users` e `wishlist_items`.

## Requisitos

- Node.js 24+ (ou Docker)
- PostgreSQL 14+ acessível pela aplicação
- Um número de WhatsApp para conectar o bot

> O bot **não** funciona sem banco de dados: o PostgreSQL é obrigatório.

## Instalação

```bash
git clone https://github.com/miguel-lamazares/My-WishBox.git
cd My-WishBox
npm ci
```

## Banco de dados

Crie usuário e database:

```sql
CREATE USER wishbox WITH PASSWORD 'sua-senha';
CREATE DATABASE wishbox OWNER wishbox;
```

Aplique o schema (tabelas, constraints e índices) com a migração:

```bash
npx tsx src/db/migrate.ts
```

Ou, manualmente:

```bash
psql -U wishbox -d wishbox -f src/db/scma.sql
```

## Configuração (.env)

Copie o arquivo de exemplo `env` para `.env` e preencha:

```bash
cp env .env
```

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `DATABASE_URL` | — | String de conexão do PostgreSQL (**obrigatória**) |
| `AUTH_DIR` | `auth_info` | Pasta onde a sessão do WhatsApp é salva |
| `COMMAND_PREFIX` | `!` | Prefixo dos comandos |
| `LOG_LEVEL` | `info` | Nível de log do pino (`debug`, `info`, `warn`, `error`) |
| `ALLOW_FROM_ME` | `1` | `1` permite enviar comandos pelo próprio número conectado |
| `ALLOWED_JIDS` | vazio | Lista de JIDs autorizados, separados por vírgula. Vazio = qualquer conversa privada |
| `DB_POOL_MAX` | `10` | Máximo de conexões no pool |
| `DB_IDLE_TIMEOUT_MS` | `30000` | Timeout de conexão ociosa |
| `DB_CONNECTION_TIMEOUT_MS` | `5000` | Timeout para obter conexão |

Exemplo:

```env
DATABASE_URL=postgres://wishbox:sua-senha@localhost:5432/wishbox
ALLOWED_JIDS=5511999999999@s.whatsapp.net
```

## Rodando

```bash
npm run dev     # desenvolvimento (tsx, hot run)
npm run build   # compila TypeScript para dist/
npm start       # produção (node dist/index.js)
```

Na primeira execução, escaneie o QR Code exibido no terminal em **WhatsApp > Dispositivos conectados**.

## Docker

O `docker-compose.yml` sobe apenas o bot (o PostgreSQL fica por sua conta — local, em outro container ou gerenciado) e persiste `./auth` e `./data`.

```bash
docker compose up --build
```

O container roda com `tty`/`stdin` abertos para você conseguir ler o QR Code:

```bash
docker compose logs -f my-wishbox
```

Lembre de apontar `DATABASE_URL` para um host alcançável de dentro do container (não `localhost`, se o banco estiver no host use `host.docker.internal` ou o IP da rede).

## Comandos

Prefixo padrão: `!`

| Comando | Uso | O que faz |
| --- | --- | --- |
| `!help` | `!help` | Lista todos os comandos |
| `!ping` | `!ping` | Testa se o bot está vivo |
| `!register` | `!register` | Inicia o cadastro guiado de um item |
| `!edit` | `!edit <id>` | Edita um item existente |
| `!delete` | `!delete <id...>` | Remove um ou mais itens |
| `!show` | `!show <id>` | Mostra os detalhes de um item |
| `!list` | `!list [categoria]` | Lista itens, opcionalmente filtrando por categoria |
| `!classes` | `!classes` | Lista as categorias existentes |
| `!search` | `!search <termo>` | Busca itens por nome |
| `!random` | `!random` | Sorteia um item da lista |
| `!buy` | `!buy <id>` | Marca item como comprado |
| `!unbuy` | `!unbuy <id>` | Desmarca a compra |
| `!move` | `!move <id...> <categoria>` | Move itens para outra categoria |
| `!budget` | `!budget <valor>` | Define seu orçamento |
| `!summary` | `!summary` | Resumo: totais, gastos e orçamento |
| `!undo` | `!undo` | Desfaz a última operação destrutiva |
| `!clear` | `!clear` | Limpa a lista |
| `!cancel` | `!cancel` | Cancela um fluxo em andamento (cadastro/edição) |

Preços aceitam formato brasileiro (`R$ 1.299,90`). Prioridade vai de `1` a `4`.

## Estrutura do projeto

```
src/
├─ index.ts              # bootstrap da aplicação
├─ config/config.ts      # leitura e validação do .env
├─ whatsapp/
│  ├─ client.ts          # conexão Baileys, QR Code, reconexão
│  └─ handlers.ts        # recebimento de mensagens
├─ commands/
│  ├─ router.ts          # registro e despacho de comandos
│  └─ commands.ts        # implementação dos comandos e fluxos guiados
├─ db/
│  ├─ client.ts          # pool do PostgreSQL
│  ├─ migrate.ts         # aplica o schema
│  ├─ scma.sql           # DDL das tabelas
│  └─ repositories/      # users, wishlist, undo
├─ types/wishlist.ts     # tipos de domínio
└─ util/                 # logger, imagens
```

## Segurança

- Nunca comite `.env`, a pasta de sessão (`auth_info`/`auth`) ou dumps do banco: as credenciais da sessão dão acesso à sua conta do WhatsApp.
- Use `ALLOWED_JIDS` para o bot responder apenas aos números que você autorizar.
- Baileys usa o WhatsApp Web de forma não oficial; use em conta pessoal e sem envio em massa.

## Licença

Veja o arquivo [LICENSE](LICENSE).
