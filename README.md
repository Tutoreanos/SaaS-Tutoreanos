# CRM de Consultoria Tutoreanos

CRM pessoal para gestão de campo, desenvolvido para acompanhar o ecossistema dos projetos de consultoria empresarial das unidades Tutoreanos.

Aplicação em produção: [crm-consultores.eron-tutoreanos.chatgpt.site](https://crm-consultores.eron-tutoreanos.chatgpt.site)

GitHub Pages: [tutoreanos.github.io/SaaS-Tutoreanos](https://tutoreanos.github.io/SaaS-Tutoreanos/)

## Funcionalidades

- visão 360º das unidades;
- programa principal e trilhas complementares;
- programas padrão e escopos personalizados;
- planejamento por etapas, objetivos e atividades;
- cronograma, responsáveis, reuniões e checklists;
- Kanban operacional dos projetos;
- Matriz GUT para priorização das ações;
- gestão de OKRs, riscos, pendências e decisões;
- biblioteca de KPIs e indicadores personalizados;
- linha de base, valor atual, meta, periodicidade e histórico de medições;
- dashboard geral de execução, progresso e evolução dos KPIs;
- pipeline comercial, contatos, clientes e agenda;
- integração com Google Agenda, seleção de calendário e sincronização de reuniões por unidade ou projeto.

Os modelos padrão permanecem protegidos. Ao editar uma etapa dentro de uma unidade, o CRM personaliza somente o escopo daquele projeto.

## Tecnologias

- React 19 e TypeScript;
- Vinext, Vite e Cloudflare Workers;
- Supabase para banco de dados e autenticação;
- PostgreSQL com Row Level Security;
- Lucide React para ícones.

## Configuração local

Requisitos:

- Node.js `>=22.13.0`;
- um projeto Supabase com as migrations deste repositório aplicadas.

Instale as dependências:

```bash
npm install
```

Crie o arquivo `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICAVEL
```

Inicie o ambiente de desenvolvimento:

```bash
npm run dev -- --host 127.0.0.1
```

## Banco de dados

As migrations estão em [`supabase/migrations`](supabase/migrations) e devem ser aplicadas em ordem cronológica.

As tabelas operacionais utilizam políticas de Row Level Security para que cada usuário autenticado acesse somente os próprios registros. Nunca utilize uma chave `service_role` no navegador e não publique o arquivo `.env.local`.

## Google Agenda

A integração usa OAuth 2.0 no fluxo de servidor. Os tokens ficam protegidos no Supabase e nunca são enviados ao GitHub Pages.

1. Ative a **Google Calendar API** no projeto do Google Cloud.
2. Configure a tela de consentimento OAuth e crie um cliente do tipo **Aplicativo da Web**.
3. Cadastre esta URI de redirecionamento autorizada:

```text
https://lytngvxjclycnqiombki.supabase.co/functions/v1/google-calendar/callback
```

4. Em **Supabase → Edge Functions → Secrets**, adicione:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
```

O segredo do cliente deve existir apenas no Supabase. Depois disso, use o botão **Conectar Google Agenda** dentro da área Agenda do CRM.

## Validação

```bash
npm run lint
npm test
```

O comando de teste executa o build, valida o artefato de hospedagem e verifica a renderização da aplicação.

## Estrutura principal

- `app/`: telas, componentes e estilos;
- `lib/`: tipos, integração Supabase e operações do CRM;
- `supabase/migrations/`: evolução do banco de dados;
- `supabase/functions/google-calendar/`: OAuth e sincronização segura com o Google Agenda;
- `tests/`: testes de renderização;
- `scripts/`: instalação, build e validação do artefato.

## Publicação

O projeto mantém dois fluxos independentes:

- ChatGPT Sites, usando o build Vinext;
- GitHub Pages, usando exportação estática do Next.js e o workflow `.github/workflows/deploy-pages.yml`.

Os próximos commits na branch `main` disparam automaticamente uma nova publicação no GitHub Pages.

## Próximo pacote comercial

- cadências e follow-ups programados por lead;
- qualificação BANT e MEDDIC;
- anexos e resumos em documento/PDF;
- funil ampulheta com onboarding, adoção, retenção e upselling após a negociação.
