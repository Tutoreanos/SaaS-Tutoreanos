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
- pipeline comercial, contatos, clientes e agenda.

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
- `tests/`: testes de renderização;
- `scripts/`: instalação, build e validação do artefato.

## Publicação

O projeto mantém dois fluxos independentes:

- ChatGPT Sites, usando o build Vinext;
- GitHub Pages, usando exportação estática do Next.js e o workflow `.github/workflows/deploy-pages.yml`.

Os próximos commits na branch `main` disparam automaticamente uma nova publicação no GitHub Pages.
