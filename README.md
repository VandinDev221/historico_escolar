# 🏛️ Sistema de Histórico Escolar Municipal

Sistema **SaaS multi-tenancy** para gerenciamento de históricos escolares de alunos da rede municipal de ensino. Cada escola gerencia seus registros de forma independente, com controle centralizado pela secretaria municipal de educação.

## Stack

| Camada      | Tecnologia                          |
|------------|--------------------------------------|
| Backend    | Node.js, NestJS, TypeScript, Prisma, PostgreSQL |
| Frontend   | Next.js 14, React 18, TypeScript, TailwindCSS, React Query, Zustand |
| Autenticação | JWT + Passport                      |
| Documentação API | Swagger/OpenAPI                 |

## Estrutura do projeto

```
armazena_historico/
├── backend/                 # API NestJS
│   ├── prisma/
│   │   ├── schema.prisma    # Modelos e enums
│   │   ├── migrations/
│   │   └── seed.ts          # Dados iniciais
│   └── src/
│       ├── modules/         # auth, users, schools, students, enrollments, grades, reports, documents, integrations
│       ├── shared/          # guards, decorators
│       └── database/        # PrismaService
├── frontend/                # Next.js 14
│   └── src/
│       ├── app/             # Rotas (login, escolas, alunos, dashboard, documentos, validar)
│       ├── components/
│       ├── lib/             # api.ts
│       └── store/           # auth (Zustand)
├── docker-compose.yml       # PostgreSQL + Redis
└── package.json            # Scripts raiz
```

## Deploy (Vercel + API na Render)

- O **`vercel.json` na raiz** faz o build em `frontend/` e define **`outputDirectory`: `frontend/.next`** (sem symlink), para o App Router e o proxy **`/api/*`** serem empacotados corretamente.
- Na Vercel, define **`BACKEND_URL`** = URL pública HTTPS da API (Render), **sem barra no fim**.
- Se o deploy falhar ou quiseres simplificar: em **Project Settings → General → Root Directory** usa **`frontend`**, remove overrides de *Build Command* no painel e deixa o **`frontend/vercel.json`** + `package.json` do Next assumirem o fluxo.
- Na Render, cada arranque corre **`migrate deploy`** e depois **`prisma db seed`** (contas `superadmin` / `admin escolar` só são criadas se ainda não existirem). Login inicial: **admin123** (ver secção Login abaixo).

## Pré-requisitos

- Node.js 18+
- PostgreSQL 14+ (ou use Docker)
- npm ou yarn

## Como rodar

### 1. Banco de dados (Docker)

```bash
npm run docker:up
```

Isso sobe PostgreSQL na porta 5432 e Redis na 6379.

### 2. Backend

```bash
cd backend
cp env.sample .env          # PowerShell: copy env.sample .env
# Ajuste DATABASE_URL, DATABASE_URL_UNPOOLED (no Docker local: mesma URL que DATABASE_URL) e JWT_SECRET no .env
npm install
npx prisma migrate deploy
npx prisma db seed
```

API: **http://localhost:3001**  
Swagger: **http://localhost:3001/api/docs**

### 3. Frontend

```bash
cd frontend
cp env.sample .env.local   # opcional; padrão local já aponta para localhost:3001
npm install
npm run dev
```

App: **http://localhost:3000**

### 4. Login (dados do seed)

- **Super Admin:** `superadmin@municipio.gov.br` / `admin123`
- **Admin Escolar:** `admin@escola.municipio.gov.br` / `admin123`

### 5. Dados em volume (Cidade Grande) — **300+ alunos por escola**

Os **300+ alunos por escola** só existem se você rodar o seed **Cidade Grande** (o seed padrão `npx prisma db seed` cria poucos dados):

```bash
cd backend
npm run prisma:seed:city
```

- Cria município **Cidade Grande**, 18 EMEFs, **350 alunos por escola** (~6.300 no total), matrículas (2022–2024) e notas.
- Pode levar **15–30 min**. Para teste rápido, edite `backend/prisma/seed-city.ts`: reduza `ALUNOS_POR_ESCOLA` (ex.: 50) e `NUM_ESCOLAS` (ex.: 3).
- Se já houver dados dessas escolas, o script limpa alunos/matrículas/notas antes de gerar de novo.

### 6. Logs em tempo real (desenvolvedor)

Logado como **Super Admin**, acesse **/dev/logs** (não há link no menu). Você verá:

- **Requisições HTTP** em tempo real: método, path, status, tempo de resposta (ms), IP, usuário
- **Erros** da API registrados no log
- Atualização automática a cada 1,5 s; botões **Atualizar** e **Limpar**

Acesso restrito ao perfil **SUPER_ADMIN** (desenvolvedor).

## Funcionalidades (MVP – Fase 1)

- [x] Autenticação (login JWT, roles: Super Admin, Admin Escolar, Professor, Pais/Responsável)
- [x] CRUD de alunos (por escola), com contatos e dados básicos
- [x] Matrículas por ano letivo e série
- [x] Lançamento de notas por disciplina e bimestre
- [x] Multi-tenancy: Super Admin vê todas as escolas; demais usuários só da própria escola
- [ ] Geração de histórico em PDF (Fase 3)

## Funcionalidades (Fase 2)

- [x] **Documentos e declarações:** geração de declarações (matrícula, transferência, conclusão, frequência), código de validação e página pública de validação (link/QR Code)
- [x] **Dashboard gerencial:** indicadores por escola e ano (total matrículas, conclusão %, evasão %), gráficos (situação e por série), exportação CSV
- [x] **Integração APIs governamentais:** módulo INEP (status e busca por código da escola); configurável via `INEP_API_URL` e `INEP_API_KEY`

## Próximas fases

- **Fase 3:** App mobile (React Native/Expo), notificações, relatórios avançados

## Evoluções implementadas (Próximas etapas)

- [x] **Geração de PDF das declarações** — declarações em PDF com QR Code; download em **Gerar declaração** e na página **Validar**.
- [x] **Mais relatórios no dashboard** — taxa de **aprovação/reprovação** (média ≥ 6 e frequência ≥ 75%), **alunos por bairro** (campo opcional no cadastro do aluno).
- [x] **Integração com a API do INEP** — com `INEP_API_KEY` e `INEP_API_URL` no `.env`, o sistema chama a API real; sem chave, retorna mock. Endpoints: `GET /integrations/inep/status` e `GET /integrations/inep/school/:code`.

## Scripts úteis

| Comando           | Descrição                    |
|-------------------|-----------------------------|
| `npm run docker:up`   | Sobe PostgreSQL e Redis     |
| `npm run backend:dev` | Backend em modo desenvolvimento |
| `npm run frontend:dev`| Frontend em modo desenvolvimento |
| `npm run db:migrate`  | Roda migrações Prisma       |
| `npm run db:studio`   | Abre Prisma Studio          |
| `npm run load-test`   | Teste de carga (backend; ver abaixo) |

### Produção: pool de conexões e HTTPS

- **Pool no PostgreSQL:** use `?connection_limit=20` na `DATABASE_URL` (ex.: `postgresql://user:pass@host:5432/armazena_historico?connection_limit=20`). Ver modelo em `backend/env.sample`.
- **HTTPS:** sirva a API atrás de proxy reverso (Nginx, Caddy, etc.) com HTTPS e defina `TRUST_PROXY=true` no `.env` para que o rate limit use o IP real do cliente.

### Testes de carga e rate limit

No backend, rode o teste de carga (API deve estar no ar):

```bash
cd backend
npm run load-test
# Ou com parâmetros: node scripts/load-test.mjs http://localhost:3001 200 10
# (baseUrl, total de requisições, concorrência)
```

O script dispara requisições contra `GET /api/health` e exibe quantas retornaram 200, quantas 429 (rate limit) e a latência. Se houver muitos 429, aumente `RATE_LIMIT_LIMIT` ou `RATE_LIMIT_TTL_MS` no `.env` e reinicie o backend.

## Segurança e LGPD

- Dados sensíveis devem ser tratados conforme política do município (criptografia, acesso auditado).
- **Já implementado:** rate limiting por IP (configurável via `RATE_LIMIT_TTL_MS` e `RATE_LIMIT_LIMIT`).
- Recomendado em produção: HTTPS, logs de auditoria de ações sensíveis, validação de CPF/documentos e backup criptografado.

## Prontidão para produção em escala

**Resumo:** o sistema está **pronto para produção em cenário pequeno/médio** (um município, dezenas de escolas, milhares de alunos, dezenas de usuários simultâneos). Para **produção em massa** (muitos municípios, centenas de escolas, dezenas de milhares de alunos, centenas de acessos simultâneos) é recomendável atender ao checklist abaixo.

### O que já ajuda

- Autenticação JWT e controle de acesso por perfil (multi-tenancy por escola).
- Rate limiting por IP (reduz abuso e DDoS leve).
- Validação de entrada (ValidationPipe, DTOs).
- Detecção de padrões suspeitos (SQLi, path traversal) e blocklist de IP (painel dev).
- Documentação da API (Swagger).
- Uso de Prisma e PostgreSQL com modelo relacional claro.

### Pontos de atenção para escala e muitos acessos

| Área | Situação atual | Recomendação |
|------|----------------|--------------|
| **Dashboard/relatórios** | Carrega todas as matrículas do ano em memória e agrega em JS. | Paginar ou agregar no banco (queries com `GROUP BY`); considerar cache (Redis) por escola/ano com TTL. |
| **Listagens** | Várias listas (alunos, escolas, documentos) podem crescer. | Garantir paginação (`take`/`skip` ou cursor) em todos os endpoints de lista. |
| **Banco** | Conexões padrão do Prisma. | Ajustar pool no `DATABASE_URL` (`?connection_limit=20`) e índices nas colunas mais filtradas (ex.: `Enrollment(schoolId, year)`). |
| **Redis** | Está no Docker mas não é usado na aplicação. | Usar para cache de sessão, cache de dashboard ou filas leves, se necessário. |
| **Logs** | Logger de dev em memória (buffer limitado). | Em produção: desativar ou restringir rotas `/api/dev/*`; usar logger estruturado (ex.: Pino) para stdout e agregador de logs. |
| **Blocklist** | Em memória (perdida ao reiniciar). | Em produção: desativar ou persistir blocklist (ex.: Redis/DB) se quiser manter. |
| **Múltiplas instâncias** | Uma instância do backend. | Para alta disponibilidade: várias réplicas atrás de load balancer; blocklist e estado em memória não são compartilhados — usar Redis ou DB. |
| **HTTPS e variáveis** | Não forçados no código. | Servir atrás de proxy reverso (HTTPS); validar variáveis obrigatórias no bootstrap (ex.: `JWT_SECRET`, `DATABASE_URL`). |
| **Health check** | Não existe. | Expor `GET /api/health` (e opcionalmente checagem do banco) para load balancer e monitoramento. |
| **Backup e migrações** | Migrações Prisma existem. | Definir política de backup do PostgreSQL e rodar migrações em pipeline de deploy. |

### Melhorias já implementadas (produção)

- **Health check:** `GET /api/health` — status da API e do banco (para load balancer e monitoramento).
- **Validação de env:** o backend exige `DATABASE_URL` e `JWT_SECRET` ao iniciar.
- **Paginação:** alunos, declarações e export de matrículas retornam `{ items, total, page, limit, totalPages }`.
- **Dashboard:** agregação no banco com `groupBy` (situação, série); menos dados em memória.
- **Rotas de dev:** com `NODE_ENV=production` ou `DISABLE_DEV_ROUTES=true`, `/api/dev/*` retorna 403.
- **Documentos do aluno:** modelo e API para anexar RG, CPF, certidão, foto, comprovante etc.; tela em **Aluno → Documentos do aluno**.

### Checklist mínimo antes de “produção em massa”

- [x] Paginação em listagens (alunos, documentos, export).
- [x] Agregação no banco para o dashboard.
- [x] Health check (`/api/health`).
- [x] Variáveis de ambiente validadas.
- [x] Rotas de dev desativáveis em produção.
- [x] Documentos do aluno (para adicionar todos os docs em produção).
- [x] Pool no `DATABASE_URL` (ex.: `?connection_limit=20`) e HTTPS (proxy).
- [x] Testes de carga e ajuste de rate limit.

Com isso, o sistema está mais preparado para produção e para adicionar todos os documentos dos alunos.

## Licença

MIT.
