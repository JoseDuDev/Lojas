# Bull Board — Design Spec
**Data:** 2026-06-09  
**Status:** Aprovado

---

## Contexto

O projeto já possui um `JobsModule` com dois processadores de filas (`email` e `search-index`) e uma página admin customizada (`/admin/jobs`) que exibe resumo das filas e permite gerenciar jobs falhados. O objetivo é adicionar o Bull Board como ferramenta de debug avançado, coexistindo com a página existente.

---

## Decisões

| Decisão | Escolha |
|---|---|
| Coexistência | Bull Board e página admin custom coexistem |
| Autenticação | Nenhuma por ora — proteger via proxy/infra no deploy |
| URL | `/bull-board` na API |
| Adapter | `@bull-board/nestjs` (NestJS idiomático) |

---

## Arquitetura

### Pacotes a instalar (apps/api)

```
@bull-board/api
@bull-board/nestjs
@bull-board/express
```

### Novo módulo: `apps/api/src/infra/bull-board/`

```
bull-board.module.ts
```

`BullBoardModule` registra as duas filas e expõe o router do Bull Board como provider. É importado no `AppModule`.

### Montagem no `main.ts`

Antes de `app.listen()`, o router é recuperado via `app.get('BULL_BOARD_ROUTER')` e montado com `app.use('/bull-board', router)`.

### Fluxo de dados

```
NestJS main.ts
  └── app.use('/bull-board', bullBoardRouter)
        └── @bull-board/express adapter
              ├── fila: email
              └── fila: search-index
```

---

## Componentes

### 1. `BullBoardModule` (novo)

- Injeta `@InjectQueue(QUEUE_EMAIL)` e `@InjectQueue(QUEUE_SEARCH)`
- Cria `BullAdapter` para cada fila
- Cria `ExpressAdapter` e chama `createBullBoard({ queues, serverAdapter })`
- Expõe o `serverAdapter.getRouter()` como provider (`BULL_BOARD_ROUTER`)

### 2. `AppModule` (alteração)

- Importa `BullBoardModule`

### 3. `main.ts` (alteração)

- Recupera o router via `app.get('BULL_BOARD_ROUTER')`
- Monta com `app.use('/bull-board', router)`

### 4. `apps/web/src/app/(admin)/admin/jobs/page.tsx` (alteração)

- Adiciona botão/link "Abrir Bull Board ↗" que abre `{API_URL}/bull-board` em nova aba
- Nenhuma outra mudança na página

---

## O que não muda

- `JobsController` e suas rotas REST — continuam servindo a página admin
- Processadores `EmailProcessor` e `SearchIndexProcessor` — sem alteração
- `jobs.constants.ts` — sem alteração
- Estrutura do `JobsModule` — sem alteração

---

## Variáveis de ambiente

Nenhuma nova variável necessária para esta implementação. Autenticação futura (Basic Auth) usaria `BULL_BOARD_USER` e `BULL_BOARD_PASS`.

---

## Fora de escopo

- Autenticação da UI do Bull Board (decisão: proteger via proxy no deploy)
- Customização de tema ou idioma do Bull Board
- Remoção da página `/admin/jobs` existente
