# 🍕 VIP Delivery

> Sistema completo de gestão de pedidos e entregas para restaurantes e estabelecimentos alimentícios

![VIP Delivery](https://img.shields.io/badge/Status-Produção-brightgreen)
![React](https://img.shields.io/badge/React-18.3.1-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5.3-blue)
![Supabase](https://img.shields.io/badge/Supabase-Backend-green)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4.11-blue)

## 📋 Sobre o Projeto

O **VIP Delivery** é uma solução completa e moderna para gestão de pedidos, entregas e operações de restaurantes. Desenvolvido com foco em performance, escalabilidade e experiência do usuário, oferece todas as ferramentas necessárias para gerenciar um negócio de alimentação de forma eficiente.

### ✨ Principais Funcionalidades

- 🏪 **Interface do Cliente**: Catálogo de produtos responsivo com carrinho de compras
- 📊 **Dashboard Administrativo**: Métricas em tempo real e relatórios detalhados
- 🎯 **Gestão de Pedidos**: Sistema Kanban para controle visual de status
- 🍔 **Catálogo de Produtos**: CRUD completo com categorias e adicionais
- 🚚 **Controle de Entregas**: Gestão de entregadores e regiões de atendimento
- 💰 **PDV Integrado**: Ponto de venda para atendimento presencial
- ⚙️ **Configurações**: Personalização completa do estabelecimento
- 📱 **Responsivo**: Interface adaptada para desktop, tablet e mobile

## 🏗️ Arquitetura e Tecnologias

### Frontend

- **React 18** - Biblioteca principal para interface
- **TypeScript** - Tipagem estática para maior segurança
- **Vite** - Build tool moderna e rápida
- **TailwindCSS** - Framework CSS utilitário
- **Shadcn/ui** - Biblioteca de componentes baseada em Radix UI
- **React Router DOM** - Roteamento client-side
- **TanStack Query** - Gerenciamento de estado servidor
- **React Hook Form** - Formulários performáticos
- **Zustand** - Gerenciamento de estado global
- **Framer Motion** - Animações fluidas

### Backend

- **Supabase** - Backend-as-a-Service
- **PostgreSQL** - Banco de dados relacional
- **Row Level Security** - Segurança a nível de linha
- **Real-time subscriptions** - Atualizações em tempo real

### Ferramentas de Desenvolvimento

- **ESLint** - Linting de código
- **PostCSS** - Processamento de CSS
- **TypeScript ESLint** - Regras específicas para TS

## 🚀 Instalação e Configuração

### Pré-requisitos

- Node.js 18+ ou Bun
- Conta no Supabase
- Git

### 1. Clone o repositório

```bash
git clone <url-do-repositorio>
cd "VIP Delivery"
```

### 2. Instale as dependências

```bash
# Com npm
npm install

# Com bun (recomendado)
bun install
```

### 3. Configure o Supabase

1. Crie um projeto no [Supabase](https://supabase.com)
2. Instale e configure o Supabase CLI:

```bash
# Instalar Supabase CLI
npm install -g supabase

# Fazer login no Supabase
supabase login

# Inicializar projeto
supabase init
```

#### Opção A: Usar Migração Consolidada (Recomendado)

```bash
# Executar o arquivo de migração consolidado
supabase db reset
# Ou importar diretamente no painel do Supabase:
# 1. Acesse seu projeto no Supabase Dashboard
# 2. Vá para SQL Editor
# 3. Cole o conteúdo de supabase/migrations/migration.sql
# 4. Execute o script
```

#### Opção B: Executar Migrações Individuais

```bash
# Executar todas as migrações na ordem correta
supabase db push
```

3. Copie `.env.example` para `.env` e configure:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

4. Configure o `project_id` em `supabase/config.toml` com o `project ref` do seu Supabase.

### 4. Execute o projeto

```bash
# Desenvolvimento
npm run dev
# ou
bun dev

# Build para produção
npm run build
# ou
bun run build
```

## 📁 Estrutura do Projeto

```
src/
├── components/          # Componentes reutilizáveis
│   ├── auth/           # Componentes de autenticação
│   ├── checkout/       # Fluxo de checkout
│   ├── dashboard/      # Componentes do dashboard
│   ├── home/           # Interface do cliente
│   ├── layout/         # Layouts da aplicação
│   ├── orders/         # Gestão de pedidos
│   ├── products/       # Gestão de produtos
│   └── ui/             # Componentes base (Shadcn)
├── contexts/           # Contextos React
├── hooks/              # Hooks customizados
├── integrations/       # Integrações externas
├── lib/                # Utilitários
├── pages/              # Páginas da aplicação
├── types/              # Definições de tipos
└── utils/              # Funções utilitárias

supabase/
├── migrations/         # Migrações do banco
└── config.toml         # Configuração do Supabase
```

## 🗄️ Banco de Dados

### Migração Consolidada

O projeto inclui um arquivo de migração consolidado em `supabase/migrations/migration.sql` que contém:

- ✅ Todas as tabelas necessárias
- ✅ Enums e tipos personalizados
- ✅ Funções utilitárias
- ✅ Triggers automáticos
- ✅ Políticas RLS (Row Level Security)
- ✅ Índices para performance
- ✅ Dados de exemplo

### Principais Tabelas

- `users` - Sistema de usuários com autenticação
- `restaurants` - Informações do estabelecimento
- `categories` - Categorias de produtos
- `products` - Catálogo de produtos
- `product_addons` - Adicionais dos produtos
- `orders` - Pedidos principais
- `order_items` - Itens dos pedidos
- `payment_methods` - Métodos de pagamento
- `business_hours` - Horários de funcionamento
- `delivery_regions` - Regiões de entrega
- `drivers` - Motoristas para entrega
- `delivery_times` - Tempos de entrega por restaurante

## 🎨 Design System

### Cores Principais

- **Primary**: `#EA1D2C` (Vermelho Delivery)
- **Success**: `#4CAF50` (Verde)
- **Background**: Tons de cinza neutros
- **Accent**: Variações do tema principal

### Tipografia

- **Heading**: Poppins
- **Body**: Inter

## 📱 Funcionalidades Detalhadas

### Interface do Cliente

- Catálogo responsivo de produtos
- Filtros por categoria
- Carrinho de compras persistente
- Sistema de adicionais por produto
- Checkout com múltiplas opções de entrega
- Rastreamento de pedidos em tempo real

### Dashboard Administrativo

- Métricas de vendas em tempo real
- Gráficos de performance
- Comparação com períodos anteriores
- Listagem de pedidos recentes
- Produtos mais vendidos

### Gestão de Pedidos

- Kanban board para controle visual
- Atualização de status por drag & drop
- Impressão de comprovantes
- Histórico completo
- Notificações em tempo real

### PDV (Ponto de Venda)

- Interface otimizada para touch
- Processamento rápido de pedidos
- Gestão de mesas
- Integração com o sistema principal

## 🔧 Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev

# Build para produção
npm run build

# Build para desenvolvimento
npm run build:dev

# Linting
npm run lint

# Preview da build
npm run preview
```

## 🚀 Deploy

### Vercel (Recomendado)

1. Conecte o repositório ao Vercel
2. Configure as variáveis de ambiente
3. Deploy automático a cada push

### Netlify

1. Build command: `npm run build`
2. Publish directory: `dist`
3. Configure redirects para SPA


---

**Desenvolvido com ❤️ Club do Software**



