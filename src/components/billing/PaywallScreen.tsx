import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Copy,
  CreditCard,
  Loader2,
  QrCode,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { digitsOnly } from "@/lib/cpf-cnpj";
import { toast } from "sonner";

type BillingType = "CREDIT_CARD" | "PIX";
type CheckoutStep = "selection" | "pix" | "credit_card";

type PixCheckoutResponse = {
  billingType: "PIX";
  subscriptionId: string;
  status: string;
  amount: number;
  paymentId: string;
  encodedImage: string;
  payload: string;
  expirationDate?: string | null;
};

type CardCheckoutResponse = {
  billingType: "CREDIT_CARD";
  subscriptionId: string;
  status: string;
  amount: number;
  cardLast4?: string;
  approved?: boolean;
};

type CreateAsaasSubscriptionResponse = PixCheckoutResponse | CardCheckoutResponse;
type CreateAsaasSubscriptionPayload = {
  tenant_id: string;
  plan_id: string;
  billingType: BillingType;
  creditCard?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
};

type BillingStatusResponse = {
  status: string | null;
  tenantStatus: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
};

type SuccessfulCheckout = {
  billingType: BillingType;
  status: string;
  amount: number;
  cardLast4?: string;
};

type CheckoutContext = {
  tenant: {
    id: string;
    name: string;
    cpf_cnpj: string | null;
    plan_id: string | null;
  };
  currentPlanId: string | null;
  hasSubscriptionHistory: boolean;
  hasBillingHistory: boolean;
  plans: Array<{
    id: string;
    name: string;
    price: number;
    type: string;
  }>;
} | null;

type PaywallScreenProps = {
  mode?: "blocked" | "renewal";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  preferredPlanId?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function translatePlanType(value?: string | null) {
  switch (String(value ?? "").toLowerCase()) {
    case "annual":
    case "yearly":
      return "Anual";
    case "semiannual":
    case "semi-annual":
    case "semester":
    case "semestral":
      return "Semestral";
    case "quarterly":
      return "Trimestral";
    case "monthly":
      return "Mensal";
    default:
      return value ?? "-";
  }
}

function translateCheckoutStatus(value?: string | null) {
  switch (String(value ?? "").toUpperCase()) {
    case "CONFIRMED":
    case "RECEIVED":
    case "ACTIVE":
      return "Pagamento aprovado";
    case "PENDING":
      return "Aguardando pagamento";
    case "OVERDUE":
    case "PAST_DUE":
      return "Pagamento em atraso";
    case "CANCELED":
    case "CANCELLED":
      return "Pagamento cancelado";
    default:
      return value ?? "-";
  }
}

function formatCardNumber(value: string) {
  return digitsOnly(value).slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function formatExpiry(value: string) {
  const digits = digitsOnly(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function formatCvv(value: string) {
  return digitsOnly(value).slice(0, 4);
}

function getPixImageSrc(encodedImage?: string) {
  if (!encodedImage) return null;
  if (encodedImage.startsWith("data:image")) return encodedImage;
  return `data:image/png;base64,${encodedImage}`;
}

export function PaywallScreen({
  mode = "blocked",
  open,
  onOpenChange,
  preferredPlanId,
}: PaywallScreenProps) {
  const { user, session } = useAuth();
  const [internalCheckoutOpen, setInternalCheckoutOpen] = useState(mode !== "renewal");
  const [selectedBillingType, setSelectedBillingType] = useState<BillingType>("CREDIT_CARD");
  const [step, setStep] = useState<CheckoutStep>("selection");
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);
  const [pixResult, setPixResult] = useState<PixCheckoutResponse | null>(null);
  const [cardResult, setCardResult] = useState<CardCheckoutResponse | null>(null);
  const [successResult, setSuccessResult] = useState<SuccessfulCheckout | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(preferredPlanId ?? null);
  const [cardForm, setCardForm] = useState({
    holderName: "",
    number: "",
    expiry: "",
    ccv: "",
  });

  const trialEndsAt = formatDate(user?.trialEndsAt);
  const subscriptionEndsAt = formatDate(user?.subscriptionCurrentPeriodEnd);
  const tenantId = user?.tenantId ?? null;
  const isEarlyRenewal = mode === "renewal";
  const isMandatoryBlockedFlow = !isEarlyRenewal;
  const isCheckoutModalOpen = open ?? internalCheckoutOpen;
  const hasSubscriptionSignal = Boolean(user?.subscriptionStatus || user?.subscriptionCurrentPeriodEnd);

  const handleCheckoutModalOpenChange = (nextOpen: boolean) => {
    if (isMandatoryBlockedFlow && !nextOpen) {
      if (open === undefined) {
        setInternalCheckoutOpen(true);
      }
      onOpenChange?.(true);
      return;
    }

    if (open === undefined) {
      setInternalCheckoutOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);
  };

  useEffect(() => {
    if (open !== undefined) {
      return;
    }

    setInternalCheckoutOpen(mode !== "renewal");
  }, [mode, open]);

  const { data: checkoutContext, isLoading: isLoadingPlan } = useQuery<CheckoutContext>({
    queryKey: ["paywall", "plan-summary", tenantId, preferredPlanId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      if (!tenantId) return null;

      const [tenantResult, subscriptionResult, billingHistoryResult] = await Promise.all([
        supabase.from("tenants").select("id, name, plan_id, cpf_cnpj").eq("id", tenantId).maybeSingle(),
        supabase
          .from("tenant_subscriptions")
          .select("id, plan_id, status, current_period_end")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("tenant_billing_history")
          .select("id")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (tenantResult.error) throw tenantResult.error;
      if (subscriptionResult.error) throw subscriptionResult.error;
      if (billingHistoryResult.error) throw billingHistoryResult.error;
      if (!tenantResult.data) return null;

      const { data: plans, error: planError } = await supabase
        .from("plans")
        .select("id, name, price, type")
        .eq("active", true)
        .order("price", { ascending: true });

      if (planError) throw planError;

      return {
        tenant: {
          id: tenantResult.data.id,
          name: tenantResult.data.name,
          cpf_cnpj: (tenantResult.data as { cpf_cnpj?: string | null }).cpf_cnpj ?? null,
          plan_id: tenantResult.data.plan_id ?? null,
        },
        currentPlanId: preferredPlanId ?? subscriptionResult.data?.plan_id ?? tenantResult.data.plan_id ?? null,
        hasSubscriptionHistory: Boolean(subscriptionResult.data?.id),
        hasBillingHistory: Boolean(billingHistoryResult.data?.id),
        plans: plans ?? [],
      };
    },
  });

  useEffect(() => {
    if (!checkoutContext) {
      return;
    }

    if (preferredPlanId && checkoutContext.plans.some((plan) => plan.id === preferredPlanId)) {
      setSelectedPlanId(preferredPlanId);
      return;
    }

    if (selectedPlanId && checkoutContext.plans.some((plan) => plan.id === selectedPlanId)) {
      return;
    }

    setSelectedPlanId(checkoutContext.currentPlanId ?? checkoutContext.plans[0]?.id ?? null);
  }, [checkoutContext, preferredPlanId, selectedPlanId]);

  const selectedPlan = checkoutContext?.plans.find((plan) => plan.id === selectedPlanId) ?? null;
  const creditCardAmount = selectedPlan ? Number((Number(selectedPlan.price) * 0.95).toFixed(2)) : 0;
  const pixAmount = selectedPlan ? Number(selectedPlan.price) : 0;
  const pixImageSrc = getPixImageSrc(pixResult?.encodedImage);
  const hasHistoricalFinancialSignal = Boolean(
    checkoutContext?.hasSubscriptionHistory || checkoutContext?.hasBillingHistory
  );
  const blockedState: "first_access_locked" | "expired_subscription" =
    !isEarlyRenewal &&
    !user?.trialEndsAt &&
    !hasSubscriptionSignal &&
    !hasHistoricalFinancialSignal
      ? "first_access_locked"
      : "expired_subscription";
  const isFirstAccessLocked = blockedState === "first_access_locked";

  const forceDashboardRefresh = () => {
    window.location.reload();
  };

  const resetCheckoutState = () => {
    setStep("selection");
    setPixResult(null);
    setCardResult(null);
    setSuccessResult(null);
    setCardForm({
      holderName: checkoutContext?.tenant.name ?? "",
      number: "",
      expiry: "",
      ccv: "",
    });
  };

  useEffect(() => {
    if (!successResult) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      forceDashboardRefresh();
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [successResult]);

  useEffect(() => {
    if (step !== "pix" || !pixResult || successResult || !tenantId || !session?.access_token) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      const { data, error } = await supabase.functions.invoke<BillingStatusResponse>("check-tenant-billing-status", {
        body: {
          tenant_id: tenantId,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error || !data) {
        return;
      }

      if (data.status !== "active") {
        return;
      }

      window.clearInterval(intervalId);
      setPixResult(null);
      setSuccessResult({
        billingType: "PIX",
        status: data.status,
        amount: pixResult.amount,
      });
      toast.success("Pagamento confirmado. Reativando o painel...");
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [step, pixResult, successResult, tenantId, session?.access_token]);

  const runCheckout = async () => {
    if (!tenantId || !session?.access_token) {
      toast.error("Sessão inválida para iniciar o checkout.");
      return;
    }
    if (!selectedPlanId) {
      toast.error("Selecione um plano para continuar.");
      return;
    }

    const cleanExpiry = digitsOnly(cardForm.expiry);
    const expiryMonth = cleanExpiry.slice(0, 2);
    const expiryYear = cleanExpiry.slice(2, 4) ? `20${cleanExpiry.slice(2, 4)}` : "";

    if (selectedBillingType === "CREDIT_CARD") {
      if (!cardForm.holderName.trim() || digitsOnly(cardForm.number).length !== 16 || cleanExpiry.length !== 4 || digitsOnly(cardForm.ccv).length < 3) {
        toast.error("Preencha corretamente os dados do cartão.");
        return;
      }
    }

    setIsSubmittingCheckout(true);
    setPixResult(null);
    setCardResult(null);
    setSuccessResult(null);

    try {
      const checkoutPayload: CreateAsaasSubscriptionPayload = {
        tenant_id: tenantId,
        plan_id: selectedPlanId,
        billingType: selectedBillingType,
        ...(selectedBillingType === "CREDIT_CARD"
          ? {
              creditCard: {
                holderName: cardForm.holderName.trim(),
                number: digitsOnly(cardForm.number),
                expiryMonth,
                expiryYear,
                ccv: digitsOnly(cardForm.ccv),
              },
            }
          : {}),
      };

      const { data, error } = await supabase.functions.invoke<CreateAsaasSubscriptionResponse>(
        "create-asaas-subscription",
        {
          body: checkoutPayload,
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );

      if (error) {
        let message = error.message || "Não foi possível processar o checkout transparente.";
        const responseContext = (error as { context?: Response }).context;

        if (responseContext) {
          try {
            const payload = await responseContext.json();
            if (typeof payload?.error === "string" && payload.error.trim()) {
              message = payload.error;
            }
          } catch {
            // Mantém a mensagem original do invoke.
          }
        }

        throw new Error(message);
      }

      if (!data) {
        throw new Error("A Edge Function não retornou dados.");
      }

      if (data.billingType === "PIX") {
        setPixResult(data);
        toast.success("QR Code Pix gerado com sucesso.");
        return;
      }

      setCardResult(data);
      setSuccessResult({
        billingType: "CREDIT_CARD",
        status: data.status,
        amount: data.amount,
        cardLast4: data.cardLast4,
      });
      toast.success("Pagamento aprovado!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível concluir o pagamento.");
    } finally {
      setIsSubmittingCheckout(false);
    }
  };

  const continueFromSelection = async () => {
    if (!selectedPlan) {
      toast.error("Nenhum plano ativo foi encontrado para esta loja.");
      return;
    }

    if (selectedBillingType === "PIX") {
      setStep("pix");
      await runCheckout();
      return;
    }

    setCardForm((current) => ({
      ...current,
      holderName: current.holderName || checkoutContext?.tenant.name || "",
    }));
    setStep("credit_card");
  };

  const handleCopyPixPayload = async () => {
    if (!pixResult?.payload) return;

    try {
      await navigator.clipboard.writeText(pixResult.payload);
      toast.success("Código Pix copiado.");
    } catch {
      toast.error("Não foi possível copiar o código Pix.");
    }
  };

  const renderSelectionStep = () => (
    <div className="space-y-5 transition-all duration-300 ease-out">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-lg font-bold text-white">
              {selectedPlan?.name ?? (isLoadingPlan ? "Carregando plano..." : "Plano indisponível")}
            </p>
          </div>
          {selectedPlan ? <p className="text-lg font-bold text-white">{formatCurrency(Number(selectedPlan.price))}</p> : null}
        </div>

        <div className="mt-4">
          <Label htmlFor="plan-select" className="text-xs uppercase tracking-[0.16em] text-zinc-500">
            Escolha o plano
          </Label>
          <select
            id="plan-select"
            value={selectedPlanId ?? ""}
            onChange={(event) => setSelectedPlanId(event.target.value)}
            className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 text-sm text-white outline-none transition focus:border-orange-400"
          >
            {checkoutContext?.plans.map((plan) => (
              <option key={plan.id} value={plan.id} className="bg-zinc-900 text-white">
                {plan.name} · {translatePlanType(plan.type)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setSelectedBillingType("CREDIT_CARD")}
          className={`rounded-3xl border p-5 text-left transition ${
            selectedBillingType === "CREDIT_CARD"
              ? "border-emerald-400/70 bg-emerald-400/10 shadow-[0_0_0_1px_rgba(74,222,128,0.35)]"
              : "border-white/10 bg-white/5 hover:border-white/20"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-400/10 p-3 text-emerald-300">
                <CreditCard className="h-6 w-6" />
              </div>
              <span className="text-lg font-semibold text-white">Cartão</span>
            </div>
            <Badge className="bg-emerald-500 text-emerald-950">5% de Desconto</Badge>
          </div>
          <p className="mt-4 text-sm leading-6 text-zinc-400">Evite bloqueios esquecendo de pagar.</p>
          <p className="mt-4 text-3xl font-semibold text-white">{selectedPlan ? formatCurrency(creditCardAmount) : "--"}</p>
        </button>

        <button
          type="button"
          onClick={() => setSelectedBillingType("PIX")}
          className={`rounded-3xl border p-5 text-left transition ${
            selectedBillingType === "PIX"
              ? "border-sky-400/70 bg-sky-400/10 shadow-[0_0_0_1px_rgba(56,189,248,0.35)]"
              : "border-white/10 bg-white/5 hover:border-white/20"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-sky-400/10 p-3 text-sky-300">
                <QrCode className="h-6 w-6" />
              </div>
              <span className="text-lg font-semibold text-white">PIX</span>
            </div>
            <Badge className="bg-white/10 text-zinc-200">Valor normal</Badge>
          </div>
          <p className="mt-4 text-sm leading-6 text-zinc-400">Pague com QRcode ou Copia e Cola.</p>
          <p className="mt-4 text-3xl font-semibold text-white">{selectedPlan ? formatCurrency(pixAmount) : "--"}</p>
        </button>
      </div>

      <div className="flex gap-4">
        {isEarlyRenewal ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => handleCheckoutModalOpenChange(false)}
            className="h-14 flex-1 rounded-2xl border-white/15 bg-transparent text-base font-semibold text-white hover:bg-white/10"
          >
            Voltar
          </Button>
        ) : null}
        <Button
          type="button"
          onClick={continueFromSelection}
          disabled={isLoadingPlan || !selectedPlan}
          className="h-14 flex-1 rounded-2xl bg-orange-500 text-base font-semibold text-white hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          Pagar
        </Button>
      </div>
    </div>
  );

  const renderPixStep = () => (
    <div className="space-y-5 transition-all duration-300 ease-out">
      <button
        type="button"
        onClick={() => {
          setStep("selection");
          setPixResult(null);
        }}
        className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para métodos de pagamento
      </button>

      {isSubmittingCheckout ? (
        <div className="rounded-3xl border border-sky-400/20 bg-sky-400/10 p-6 text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-sky-300" />
          <p className="mt-3 text-lg font-semibold text-white">Processando...</p>
          <p className="mt-2 text-sm text-sky-100/80">Gerando QR Code Pix.</p>
        </div>
      ) : pixResult ? (
        <div className="grid gap-4 rounded-3xl border border-sky-400/30 bg-sky-400/10 p-5 md:grid-cols-[220px_1fr]">
          <div className="rounded-2xl bg-white p-4">
            {pixImageSrc ? (
              <img src={pixImageSrc} alt="QR Code Pix" className="mx-auto h-44 w-44 object-contain" />
            ) : (
              <div className="flex h-44 items-center justify-center text-center text-sm text-slate-500">QR Code indisponível</div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-sky-200/80">Pix gerado</p>
              <h3 className="mt-2 text-xl font-semibold text-white">{translateCheckoutStatus(pixResult.status)}</h3>
              <p className="mt-2 text-sm text-sky-100/80">Escaneie o QR Code ou copie o código para concluir o pagamento.</p>
            </div>

            <div className="rounded-2xl border border-sky-400/20 bg-black/20 p-4">
              <p className="mb-2 text-xs uppercase tracking-[0.16em] text-sky-200/70">Pix Copia e Cola</p>
              <Input readOnly value={pixResult.payload} className="border-sky-400/20 bg-white/90 text-slate-900" />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button type="button" className="bg-sky-300 text-sky-950 hover:bg-sky-200" onClick={handleCopyPixPayload}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar código
              </Button>
              {pixResult.expirationDate ? (
                <div className="text-sm text-sky-100/80">
                  Expira em {new Date(pixResult.expirationDate).toLocaleString("pt-BR")}
                </div>
              ) : null}
            </div>

            <p className="text-sm text-sky-100/80">
              A confirmação do PIX é verificada automaticamente a cada 5 segundos.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 p-5 text-sm text-rose-100">
          Não foi possível gerar o Pix. Volte e tente novamente.
        </div>
      )}
    </div>
  );

  const renderCreditCardStep = () => (
    <div className="space-y-5 transition-all duration-300 ease-out">
      <div className="grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="card-holder">Nome no cartão</Label>
          <Input
            id="card-holder"
            value={cardForm.holderName}
            onChange={(event) => setCardForm((current) => ({ ...current, holderName: event.target.value }))}
            placeholder={checkoutContext?.tenant.name || "Nome impresso no cartão"}
            className="border-white/10 bg-white/5 text-white placeholder:text-zinc-500"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="card-number">Número do cartão</Label>
          <Input
            id="card-number"
            value={cardForm.number}
            onChange={(event) => setCardForm((current) => ({ ...current, number: formatCardNumber(event.target.value) }))}
            placeholder="0000 0000 0000 0000"
            className="border-white/10 bg-white/5 text-white placeholder:text-zinc-500"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="card-expiry">Validade</Label>
          <Input
            id="card-expiry"
            value={cardForm.expiry}
            onChange={(event) => setCardForm((current) => ({ ...current, expiry: formatExpiry(event.target.value) }))}
            placeholder="MM/AA"
            className="border-white/10 bg-white/5 text-white placeholder:text-zinc-500"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="card-ccv">CVV</Label>
          <Input
            id="card-ccv"
            value={cardForm.ccv}
            onChange={(event) => setCardForm((current) => ({ ...current, ccv: formatCvv(event.target.value) }))}
            placeholder="123"
            className="border-white/10 bg-white/5 text-white placeholder:text-zinc-500"
          />
        </div>
      </div>

      <div className="flex gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setStep("selection");
            setCardResult(null);
          }}
          className="h-14 flex-1 rounded-2xl border-white/15 bg-transparent text-base font-semibold text-white hover:bg-white/10"
        >
          Voltar
        </Button>
        <Button
          type="button"
          onClick={runCheckout}
          disabled={isSubmittingCheckout}
          className="h-14 flex-1 rounded-2xl bg-orange-500 text-base font-semibold text-white hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmittingCheckout ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processando...
            </>
          ) : (
            "Pagar"
          )}
        </Button>
      </div>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="space-y-5 transition-all duration-300 ease-out">
      <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-300">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-emerald-200/80">Pagamento Aprovado!</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Assinatura ativada com sucesso</h3>
            <p className="mt-2 text-sm text-emerald-100/80">
              {translateCheckoutStatus(successResult?.status)}
              {successResult?.cardLast4 ? ` • Cartão final ${successResult.cardLast4}` : ""}
            </p>
            <p className="mt-3 text-sm text-emerald-100/70">
              Redirecionando automaticamente em 3 segundos...
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1 border-white/15 bg-transparent text-white hover:bg-white/10" onClick={forceDashboardRefresh}>
          Fechar
        </Button>
        <Button type="button" className="flex-1 bg-emerald-500 text-emerald-950 hover:bg-emerald-400" onClick={forceDashboardRefresh}>
          Voltar ao painel
        </Button>
      </div>
    </div>
  );

  const dialogContent = (
    <Dialog
      open={isCheckoutModalOpen}
      onOpenChange={(nextOpen) => {
        handleCheckoutModalOpenChange(nextOpen);

        if (!nextOpen) {
          if (isMandatoryBlockedFlow) {
            return;
          }

          if (successResult) {
            forceDashboardRefresh();
            return;
          }

          resetCheckoutState();
        }
      }}
    >
      <DialogContent
        className={`border-white/10 bg-zinc-950 text-white sm:max-w-2xl ${!isEarlyRenewal ? "[&>button]:hidden" : ""}`}
        onEscapeKeyDown={(event) => {
          if (isMandatoryBlockedFlow) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          if (isMandatoryBlockedFlow) {
            event.preventDefault();
          }
        }}
        onPointerDownOutside={(event) => {
          if (isMandatoryBlockedFlow) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">
            {isEarlyRenewal ? (
              "Renove sua assinatura"
            ) : (
              "Checkout Transparente"
            )}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {isEarlyRenewal
              ? "Garanta a continuidade do seu painel e PDV sem interrupções."
              : "Conclua o pagamento sem sair do painel."}
          </DialogDescription>
        </DialogHeader>

        {successResult ? (
          renderSuccessStep()
        ) : step === "selection" ? (
          renderSelectionStep()
        ) : step === "pix" ? (
          renderPixStep()
        ) : (
          renderCreditCardStep()
        )}
      </DialogContent>
    </Dialog>
  );

  if (isEarlyRenewal) {
    return dialogContent;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.18),_transparent_32%),linear-gradient(180deg,_#09090b_0%,_#111827_100%)] px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[32px] border border-white/10 bg-white/6 p-8 shadow-2xl shadow-orange-950/20 backdrop-blur xl:p-12">
            <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm font-medium text-amber-100">
              <AlertTriangle className="h-4 w-4" />
              {isFirstAccessLocked ? "Ativação pendente" : "Acesso temporariamente bloqueado"}
            </div>

            <div className="space-y-5">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-zinc-400">Pagamento Seguro</p>
                <h1 className="mt-3 text-4xl font-semibold leading-tight text-white xl:text-5xl">
                  {isFirstAccessLocked ? "Ative seu sistema" : "Sua assinatura expirou"}
                </h1>
              </div>

              <p className="max-w-2xl text-base leading-7 text-zinc-300 xl:text-lg">
                {isFirstAccessLocked ? (
                  <>
                    Finalize sua assinatura para liberar o acesso ao painel, PDV, pedidos e configurações da sua loja.
                  </>
                ) : (
                  <>
                    O acesso ao painel foi pausado até a regularização financeira. Assim que o pagamento for confirmado, o
                    sistema volta a ficar disponível.
                  </>
                )}
              </p>
            </div>

            <div className="mt-10 flex flex-wrap gap-4">
              <Button
                type="button"
                onClick={() => {
                  resetCheckoutState();
                  handleCheckoutModalOpenChange(true);
                }}
                className="h-auto rounded-2xl bg-orange-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-orange-950/30 transition hover:bg-orange-400"
              >
                <CreditCard className="mr-2 h-5 w-5" />
                {isFirstAccessLocked ? "Ativar agora" : "Regularizar assinatura"}
              </Button>
            </div>
          </section>

          <aside className="rounded-[32px] border border-white/10 bg-zinc-950/70 p-8 shadow-2xl shadow-black/30 backdrop-blur xl:p-10">
            {isFirstAccessLocked ? (
              <div className="space-y-5">
                <div className="mb-6 flex items-center gap-3">
                  <div className="rounded-2xl bg-orange-500/15 p-3 text-orange-300">
                    <CalendarClock className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-zinc-500">Ativação inicial</p>
                    <h2 className="text-2xl font-semibold text-white">Liberação de acesso</h2>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/8 bg-white/5 p-5 text-sm leading-7 text-zinc-200">
                  Seu acesso será liberado após a confirmação do pagamento.
                </div>

                <div className="rounded-3xl border border-orange-400/15 bg-orange-500/10 p-5 text-sm leading-6 text-orange-100">
                  Após a ativação, painel, PDV, pedidos e configurações ficam disponíveis automaticamente.
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6 flex items-center gap-3">
                  <div className="rounded-2xl bg-orange-500/15 p-3 text-orange-300">
                    <CalendarClock className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-zinc-500">Datas de expiração</p>
                    <h2 className="text-2xl font-semibold text-white">Status financeiro</h2>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-3xl border border-white/8 bg-white/5 p-5">
                    <p className="text-sm text-zinc-400">Fim do ciclo atual da assinatura</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{subscriptionEndsAt ?? "Não disponível"}</p>
                  </div>

                  <div className="rounded-3xl border border-white/8 bg-white/5 p-5">
                    <p className="text-sm text-zinc-400">Referência financeira anterior</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{trialEndsAt ?? "Não disponível"}</p>
                  </div>
                </div>

                <div className="mt-6 rounded-3xl border border-orange-400/15 bg-orange-500/10 p-5 text-sm leading-6 text-orange-100">
                  Regularize a assinatura para reativar pedidos, painel, PDV e operação administrativa da loja.
                </div>
              </>
            )}
          </aside>
        </div>
      </div>

      {dialogContent}
    </div>
  );
}



