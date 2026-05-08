import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Check,
  Clock3,
  CreditCard,
  ExternalLink,
  Menu,
  MessageSquare,
  MonitorSmartphone,
  Package,
  QrCode,
  ShieldCheck,
  Star,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";

import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import heroImage from "@/assets/hero-1.webp";

const featureCards = [
  {
    icon: Store,
    title: "Cardápio digital próprio",
    description:
      "Sua loja com identidade própria para divulgar no Instagram, WhatsApp e Google.",
  },
  {
    icon: MonitorSmartphone,
    title: "Painel em tempo real",
    description:
      "Acompanhe pedidos, operação, faturamento e desempenho da loja em um único painel responsivo.",
  },
  {
    icon: Package,
    title: "PDV integrado",
    description:
      "Pedidos presenciais com agilidade, organize o balcão e centralize a operação local no mesmo painel.",
  },
];

type PlanRow = Database["public"]["Tables"]["plans"]["Row"];

const testimonials = [
  {
    name: "Lanchonete Prime",
    role: "Operação urbana",
    quote:
      "Saímos de pedidos espalhados em WhatsApp e papel para uma operação centralizada e muito mais rápida.",
  },
  {
    name: "Pizzaria Central",
    role: "Delivery noturno",
    quote:
      "O link próprio e o painel em tempo real melhoraram o controle dos pedidos e reduziram ruído no atendimento.",
  },
  {
    name: "Sabor da Vila",
    role: "Restaurante de bairro",
    quote:
      "Hoje vendemos com marca própria, organizamos o caixa e conseguimos acompanhar a saúde da operação com clareza.",
  },
];

const platformNumbers = [
  { label: "Lojas operando", value: "1.200+" },
  { label: "Pedidos gerenciados", value: "45M+" },
  { label: "Taxa por pedido", value: "0%" },
  { label: "Disponibilidade", value: "99,9%" },
];

const landingNavItems = [
  { href: "#visao-geral", label: "Visão Geral" },
  { href: "#recursos", label: "Recursos" },
  { href: "#planos", label: "Planos" },
  { href: "#provas", label: "Provas Sociais" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatCurrencyValue(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function splitCurrencyValue(value: number) {
  const [integer, decimal = "00"] = formatCurrencyValue(value).split(",");
  return { integer, decimal };
}

function getPlanCycleLabel(type: PlanRow["type"]) {
  switch (type) {
    case "annual":
      return "Anual";
    case "quarterly":
      return "Trimestral";
    default:
      return "Mensal";
  }
}

function getPlanCycleDescription(type: PlanRow["type"]) {
  switch (type) {
    case "annual":
      return "cobrança anual";
    case "quarterly":
      return "cobrança trimestral";
    default:
      return "cobrança mensal";
  }
}

function getPlanFeatures(features: PlanRow["features"]) {
  if (Array.isArray(features)) {
    return features.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  return [
    "Dashboard completo",
    "Gestão de pedidos",
    "PDV integrado",
    "Relatórios operacionais",
  ];
}

export default function Index() {
  const { data: plans = [] } = useQuery<PlanRow[]>({
    queryKey: ["landing", "plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("id, name, price, type, billing_days, description, features, active")
        .eq("active", true)
        .in("type", ["monthly", "quarterly", "annual"])
        .order("price", { ascending: true });

      if (error) {
        throw error;
      }

      return data ?? [];
    },
  });
  const monthlyPlan = plans.find((plan) => plan.type === "monthly") ?? null;
  const landingContainerClass = "mx-auto w-full max-w-[1400px] px-6 md:px-8";
  const signupLink = "/login?tab=signup&from=landing";
  const neutralActionClass =
    "border-gray-200 bg-gray-100 text-foreground shadow-md hover:bg-gray-100/90 dark:border-gray-500 dark:bg-gray-600 dark:hover:bg-gray-600/90";
  const redActionClass = "border border-white/50 shadow-md";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(circle_at_top,rgba(234,29,44,0.18),transparent_58%)] dark:bg-[radial-gradient(circle_at_top,rgba(234,29,44,0.22),transparent_58%)]" />
        <div className="absolute right-0 top-28 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute left-0 top-[28rem] h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className={cn(landingContainerClass, "flex h-16 items-center justify-between gap-2 md:gap-4")}>
          <Link to="/" className="flex min-w-0 flex-1 items-center gap-3 md:flex-none">
            <img src="/vip-delivery-logo.png" alt="VIP Delivery" className="h-12 w-auto object-contain" />
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {landingNavItems.map((item) => (
              <a key={item.href} href={item.href} className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            <ThemeToggle className={neutralActionClass} />
            <Button asChild variant="outline" className={cn("hidden md:inline-flex", neutralActionClass)}>
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild className={cn("hidden rounded-xl px-5 md:inline-flex", redActionClass)}>
              <Link to={signupLink}>
                Começar agora
              </Link>
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className={cn("rounded-xl md:hidden", neutralActionClass)} aria-label="Abrir menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] max-w-none border-border/60 bg-background/95 p-6 sm:max-w-sm">
                <div className="flex items-center gap-3 border-b border-border/60 pb-5 pr-10">
                  <img src="/vip-delivery-logo.png" alt="VIP Delivery" className="h-12 w-auto object-contain" />
                </div>

                <div className="mt-6 space-y-2">
                  {landingNavItems.map((item) => (
                    <SheetClose key={item.href} asChild>
                      <a
                        href={item.href}
                        className={cn(
                          "flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium text-foreground transition-colors",
                          neutralActionClass
                        )}
                      >
                        {item.label}
                        <ArrowRight className="h-4 w-4" />
                      </a>
                    </SheetClose>
                  ))}
                </div>

                <div className="mt-6 grid gap-3">
                  <SheetClose asChild>
                    <Button asChild size="lg" variant="outline" className={cn("rounded-2xl", neutralActionClass)}>
                      <Link to="/login">Entrar</Link>
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button asChild size="lg" className={cn("rounded-2xl", redActionClass)}>
                      <Link to={signupLink}>Começar agora</Link>
                    </Button>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main>
        <section id="visao-geral" className={cn(landingContainerClass, "grid gap-14 pb-6 pt-0 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-20 md:pb-20 md:pt-0")}>
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.22em] text-muted-foreground shadow-sm">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Operação para Delivery
            </div>

            <h1 className="text-4xl font-bold leading-[1.14] tracking-tight sm:text-5xl lg:text-6xl xl:text-[3.5rem]">
              Transforme seu restaurante em uma
              <span className="block pb-[0.12em] bg-gradient-to-r from-primary via-orange-500 to-yellow-400 bg-clip-text text-transparent">
                máquina de vendas digital
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
              Cardápio digital, pedidos, PDV, e gestão do negócio em um único sistema com visual premium,
              operação rápida e marca própria.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Button asChild size="lg" className={cn("rounded-2xl px-8 text-base", redActionClass)}>
                <Link to={signupLink}>
                  Garantir meu acesso
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className={cn("rounded-2xl px-8 text-base", neutralActionClass)}>
                <a href="#planos">
                  Ver planos
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Sem taxa por pedido
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Link próprio da loja
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-6 top-10 hidden h-40 w-40 rounded-full bg-primary/10 blur-3xl lg:block" />
            <div className="absolute -bottom-8 right-0 hidden h-44 w-44 rounded-full bg-primary/10 blur-3xl lg:block" />

            <div className="relative">
              <img
                src="/vip-delivery-logo-hero.png"
                alt="VIP Delivery"
                className="block h-auto w-full object-contain drop-shadow-2xl"
              />

              <div className="absolute top-10 hidden w-56 rounded-[1.5rem] border border-border/60 bg-card/85 p-4 shadow-md md:-left-10 md:block lg:-left-12 xl:-left-14">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Pedido novo</p>
                <p className="mt-2 text-lg font-bold">#4582 • R$ 124,90</p>
                <div className="flex gap-2">
                  <span className="rounded-full bg-emerald-500/15 border border-emerald-500 px-3 py-1 text-[11px] font-semibold text-emerald-500">
                    Em Preparo
                  </span>
                  <span className="rounded-full bg-primary/10 border border-red-400 px-3 py-1 text-[11px] font-semibold text-primary">
                    Entrega
                  </span>
                </div>
              </div>

              <div className="absolute bottom-5 right-6 hidden w-64 rounded-[1.5rem] border border-border/60 bg-card/85 p-4 shadow-md sm:block">
                <div>
                  <div className="flex items-center gap-2 rounded-2xl">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl text-primary">
                      <Store className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Delivery Próprio</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 rounded-2xl">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl text-primary">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Escale seu Negócio</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border/60 bg-card/40 py-6 md:py-14">
          <div className={cn(landingContainerClass, "grid grid-cols-2 gap-8 sm:grid-cols-2 xl:grid-cols-4")}>
            {platformNumbers.map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-4xl font-bold tracking-tight text-primary">{item.value}</p>
                <p className="mt-2 text-sm text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="recursos" className={cn(landingContainerClass, "py-6 md:py-24")}>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Recursos</p>
            <h2 className="mt-4 text-4xl font-bold tracking-tight">Tudo que sua operação precisa, em um só lugar</h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              Sem remendo de ferramenta, sem perda de contexto e sem depender de marketplace para vender todos os dias.
            </p>
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {featureCards.map((feature) => (
              <Card key={feature.title} className="group rounded-[1.75rem] border-border/60 bg-card/70 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5">
                <CardContent className="flex h-full flex-col p-8">
                  <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-2xl font-semibold">{feature.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-muted-foreground">{feature.description}</p>
                  <div className="mt-auto pt-8 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                    VIP Delivery
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-16 grid gap-8 rounded-[2rem] border border-border/60 bg-card/60 p-8 lg:grid-cols-[0.95fr_1.05fr] lg:p-10">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Performance operacional</p>
              <h3 className="mt-4 text-3xl font-bold tracking-tight">Mais margem, menos ruído e controle real da loja</h3>
              <p className="mt-4 text-base leading-8 text-muted-foreground">
                O VIP Delivery foi desenhado para centralizar cardápio, atendimento, pagamentos, painel administrativo e gestão do negócio.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: Clock3, title: "Agilidade", text: "Pedidos entram organizados e a equipe trabalha com menos atrito." },
                { icon: Users, title: "Relacionamento", text: "Sua base de clientes continua sendo sua, com canal direto." },
                { icon: BarChart3, title: "Visibilidade", text: "Acompanhe a operação com mais clareza e tome decisões melhores no dia a dia." },
                { icon: ShieldCheck, title: "Operacional", text: "Painel estruturado para operação profissional e crescimento." },
              ].map((item) => (
                <div key={item.title} className="rounded-3xl border border-border/60 bg-background/70 p-5">
                  <item.icon className="h-5 w-5 text-primary" />
                  <h4 className="mt-4 text-lg font-semibold">{item.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="planos" className="border-y border-border/60 bg-card/35 py-6 md:py-24">
          <div className={landingContainerClass}>
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Planos</p>
              <h2 className="mt-4 text-4xl font-bold tracking-tight">Escolha o ritmo certo para o seu restaurante</h2>
              <p className="mt-4 text-lg leading-8 text-muted-foreground">
                Estrutura simples, clara e preparada para crescer com a sua operação.
              </p>
            </div>

            <div className="mt-14 grid gap-6 xl:grid-cols-3">
              {plans.map((plan) => {
                const pixPrice = Number(plan.price);
                const cardPrice = Number((pixPrice * 0.95).toFixed(2));
                const pixParts = splitCurrencyValue(pixPrice);
                const cardParts = splitCurrencyValue(cardPrice);
                const features = getPlanFeatures(monthlyPlan?.features ?? plan.features);
                const highlight = plan.type === "quarterly";
                const cycleMultiplier =
                  plan.type === "annual" ? 12 :
                  plan.type === "quarterly" ? 3 :
                  1;
                const discountPercent = monthlyPlan
                  ? Math.max(0, Math.round((1 - pixPrice / (Number(monthlyPlan.price) * cycleMultiplier)) * 100))
                  : 0;

                return (
                <Card
                  key={plan.name}
                  className={cn(
                    "rounded-[2rem] border-border/60 bg-background/80 shadow-sm",
                    highlight && "border-primary/40 bg-primary/5 shadow-xl shadow-primary/10"
                  )}
                >
                  <CardContent className="flex h-full flex-col p-8">
                    <div className="min-h-[4.5rem]">
                      <div className="mb-4 flex min-h-[1.75rem] items-center justify-center">
                        {highlight ? (
                          <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground">
                            Mais popular
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-start justify-between gap-4">
                        <h3 className="text-3xl font-bold">{plan.name}</h3>
                        {discountPercent > 0 ? (
                          <span className="inline-flex items-baseline rounded-full border border-white/70 bg-emerald-500 px-3 py-1 text-white shadow-[0_0_24px_rgba(34,197,94,0.42)] dark:border-white/60 dark:bg-emerald-400 dark:text-white dark:shadow-[0_0_24px_rgba(74,222,128,0.55)]">
                            <span className="text-sm font-bold leading-none tracking-[0.08em]">
                              {discountPercent}%
                            </span>
                            <span className="text-[10px] font-semibold space-y-3 leading-none tracking-[0.18em]">
                              Off
                            </span>
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-8 rounded-3xl border border-border/60 bg-card/70 p-5">
                      <div>
                        <div>
                          <div className="flex items-center gap-2">
                            <QrCode className="h-4 w-4 text-primary" />
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">PIX</p>
                          </div>
                          <div className="mt-2 flex items-start gap-0.5 text-orange-500">
                            <span className="text-5xl font-extrabold leading-none tracking-tight">
                              {pixParts.integer},
                            </span>
                            <span className="pt-1 text-2xl font-bold leading-none tracking-tight">{pixParts.decimal}</span>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <CreditCard className="h-4 w-4 text-primary" />
                            <span className="text-sm leading-6 text-muted-foreground">No cartão:</span>
                            <span className="flex items-start gap-0.5 text-orange-500">
                              <span className="text-2xl font-bold leading-none tracking-tight">
                                {cardParts.integer},
                              </span>
                              <span className="pt-0.5 text-base font-semibold leading-none tracking-tight">{cardParts.decimal}</span>
                            </span>
                            <span className="text-sm leading-6 text-muted-foreground">(5% de desconto).</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 space-y-4">
                      {features.map((feature) => (
                        <div key={feature} className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-sm leading-6 text-muted-foreground">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {getPlanCycleLabel(plan.type)} • renovação a cada {plan.billing_days} dias
                    </div>

                    <Button
                      asChild
                      size="lg"
                      variant={highlight ? "default" : "outline"}
                      className={cn("mt-10 rounded-2xl", highlight && redActionClass)}
                    >
                      <Link to={signupLink}>Quero começar</Link>
                    </Button>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section id="provas" className={cn(landingContainerClass, "py-6 md:py-24")}>
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Provas Sociais</p>
            <h2 className="mt-4 text-4xl font-bold tracking-tight">Restaurantes precisam de operação, não de promessa vazia</h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              Estruturamos a landing com prova social porque confiança vem de consistência operacional e percepção de marca.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {testimonials.map((item) => (
              <Card key={item.name} className="rounded-[1.75rem] border-border/60 bg-card/70">
                <CardContent className="p-8">
                  <div className="mb-5 flex items-center gap-1 text-yellow-400">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star key={`${item.name}-${index}`} className="h-6 w-6 fill-current" />
                    ))}
                  </div>
                  <p className="text-base leading-8 text-foreground/90">“{item.quote}”</p>
                  <div className="mt-8">
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-muted-foreground">{item.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className={cn(landingContainerClass, "py-6 md:pb-24 md:pt-0")}>
          <div className="overflow-hidden rounded-[2.5rem] border border-border/60 bg-card/70 p-8 shadow-2xl shadow-primary/5 lg:p-14">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Pronto para vender mais?</p>
                <h2 className="mt-4 text-4xl font-bold tracking-tight">Coloque seu delivery online com operação profissional</h2>
                <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
                  Teste o VIP Delivery e coloque cardápio, pedidos, checkout e painel no mesmo fluxo.
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row lg:flex-col">
                <Button asChild size="lg" className={cn("rounded-2xl px-8", redActionClass)}>
                  <Link to={signupLink}>Criar conta</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-2xl px-8">
                  <Link to="/login">Entrar no sistema</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-card/40 py-10">
        <div className="container flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <img src="/vip-delivery-logo.png" alt="VIP Delivery" className="h-12 w-auto object-contain" />
          </div>

          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            <a href="#recursos" className="transition-colors hover:text-foreground">
              Recursos
            </a>
            <a href="#planos" className="transition-colors hover:text-foreground">
              Planos
            </a>
            <Link to="/login" className="transition-colors hover:text-foreground">
              Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}



