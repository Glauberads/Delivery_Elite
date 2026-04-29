import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Copy, CreditCard, Loader2, QrCode, ShieldCheck } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { digitsOnly, formatCpfCnpj, isValidCpfCnpj } from "@/lib/cpf-cnpj";

type CheckoutPageState = {
  planId?: string;
};

type PaymentMethod = "CREDIT_CARD" | "PIX";

type CheckoutFunctionResponse = {
  subscriptionId: string;
  status: string;
  encodedImage?: string;
  payload?: string;
  expirationDate?: string | null;
  cardLast4?: string;
};

type CheckoutQueryResult = {
  tenant: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    cpf_cnpj: string | null;
  };
  subscription: {
    id: string;
    plan_id: string;
    status: string | null;
  } | null;
};

type CheckoutPlan = {
  active?: boolean | null;
  id: string;
  name: string;
  description: string | null;
  price: number;
  type: "monthly" | "quarterly" | "annual";
  billing_days: number;
};

const trustSeals = [
  {
    title: "Checkout Seguro",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l7 3v5c0 4.5-2.9 8.3-7 9.5C7.9 19.3 5 15.5 5 11V6l7-3Z" />
        <path d="M9.5 11.5 11 13l3.5-4" />
      </svg>
    ),
  },
  {
    title: "Satisfação Garantida",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21s-6.5-4.2-8.5-8.4C1.8 9.4 3.3 5.8 7 5.2c2-.3 3.5.6 5 2.1 1.5-1.5 3-2.4 5-2.1 3.7.6 5.2 4.2 3.5 7.4C18.5 16.8 12 21 12 21Z" />
      </svg>
    ),
  },
  {
    title: "Privacidade Protegida",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V8a4 4 0 1 1 8 0v2" />
        <circle cx="12" cy="15" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function getPlanTypeLabel(type?: CheckoutPlan["type"] | null) {
  switch (type) {
    case "annual":
      return "Anual";
    case "quarterly":
      return "Trimestral";
    case "monthly":
      return "Mensal";
    default:
      return type ?? "-";
  }
}

function getCheckoutStatusLabel(status?: string | null) {
  switch (String(status ?? "").toUpperCase()) {
    case "ACTIVE":
      return "Ativo";
    case "PENDING":
      return "Pendente";
    case "RECEIVED":
      return "Recebido";
    case "CONFIRMED":
      return "Confirmado";
    case "OVERDUE":
    case "PAST_DUE":
      return "Em atraso";
    case "CANCELED":
    case "CANCELLED":
      return "Cancelado";
    default:
      return status ?? "-";
  }
}

function formatCardNumber(value: string) {
  return digitsOnly(value).slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function formatExpiry(value: string) {
  const digits = digitsOnly(value).slice(0, 4);

  if (digits.length <= 2) {
    return digits;
  }

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

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Não foi possível iniciar o checkout.";
}

export default function Checkout() {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const locationState = location.state as CheckoutPageState | null;
  const requestedPlanId = searchParams.get("plan") ?? searchParams.get("planId") ?? locationState?.planId ?? "";

  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CREDIT_CARD");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [pixResult, setPixResult] = useState<CheckoutFunctionResponse | null>(null);
  const [cardResult, setCardResult] = useState<CheckoutFunctionResponse | null>(null);
  const [lastPixRequestKey, setLastPixRequestKey] = useState("");
  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    cpfCnpj: "",
    cardNumber: "",
    holderName: "",
    expiry: "",
    cvv: "",
  });

  const { data: plans = [], isLoading: isLoadingPlans } = useQuery<CheckoutPlan[]>({
    queryKey: ["checkout", "plans"],
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("active", true)
        .order("price", { ascending: true });

      if (error) throw error;
      return (data ?? []) as CheckoutPlan[];
    },
  });

  const { data, isLoading: isLoadingTenant } = useQuery<CheckoutQueryResult>({
    queryKey: ["tenant", "checkout", "profile", user?.tenantId],
    enabled: Boolean(user?.tenantId),
    queryFn: async () => {
      const tenantId = user?.tenantId;

      if (!tenantId) {
        throw new Error("Loja não encontrada para o usuário logado.");
      }

      const tenantPromise = (supabase.from("tenants") as never as {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            maybeSingle: () => Promise<{
              data: {
                id: string;
                name: string;
                email: string | null;
                phone: string | null;
                cpf_cnpj?: string | null;
              } | null;
              error: Error | null;
            }>;
          };
        };
      })
        .select("id, name, email, phone, cpf_cnpj")
        .eq("id", tenantId)
        .maybeSingle();

      const [tenantResult, subscriptionResult] = await Promise.all([
        tenantPromise,
        supabase
          .from("tenant_subscriptions")
          .select("id, plan_id, status")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (tenantResult.error) throw tenantResult.error;
      if (subscriptionResult.error) throw subscriptionResult.error;
      if (!tenantResult.data) throw new Error("Loja não encontrada.");

      return {
        tenant: {
          id: tenantResult.data.id,
          name: tenantResult.data.name,
          email: tenantResult.data.email,
          phone: tenantResult.data.phone,
          cpf_cnpj: (tenantResult.data as { cpf_cnpj?: string | null }).cpf_cnpj ?? null,
        },
        subscription: subscriptionResult.data,
      };
    },
  });

  useEffect(() => {
    if (!data) return;

    setForm((prev) => ({
      ...prev,
      customerName: prev.customerName || data.tenant.name || "",
      customerEmail: prev.customerEmail || data.tenant.email || user?.email || "",
      cpfCnpj: prev.cpfCnpj || data.tenant.cpf_cnpj || "",
      holderName: prev.holderName || data.tenant.name || "",
    }));
  }, [data, user?.email]);

  useEffect(() => {
    if (plans.length === 0) return;

    const requestedPlan = requestedPlanId ? plans.find((plan) => plan.id === requestedPlanId) : null;
    const currentPlan = data?.subscription ? plans.find((plan) => plan.id === data.subscription?.plan_id) : null;
    const monthlyPlan = plans.find((plan) => plan.name.trim().toLowerCase() === "mensal" || plan.type === "monthly") ?? null;
    const fallbackPlan = requestedPlan ?? currentPlan ?? monthlyPlan ?? plans[0] ?? null;
    const hasSelectedPlan = selectedPlanId ? plans.some((plan) => plan.id === selectedPlanId) : false;

    if (!hasSelectedPlan && fallbackPlan) {
      setSelectedPlanId(fallbackPlan.id);
    }
  }, [data?.subscription, plans, requestedPlanId, selectedPlanId]);

  useEffect(() => {
    if (!cardResult) return;

    const timeout = window.setTimeout(() => {
      navigate("/dashboard");
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [cardResult, navigate]);

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? null;
  const pixImageSrc = getPixImageSrc(pixResult?.encodedImage);
  const currentPixRequestKey = user?.tenantId && selectedPlan ? `${user.tenantId}:${selectedPlan.id}` : "";
  const cleanDocument = digitsOnly(form.cpfCnpj);
  const cleanCardNumber = digitsOnly(form.cardNumber);
  const cleanExpiry = digitsOnly(form.expiry);
  const cleanCvv = digitsOnly(form.cvv);
  const hasValidExpiryFormat = /^(0[1-9]|1[0-2])\/\d{2}$/.test(form.expiry);
  const hasDocumentInput = cleanDocument.length > 0;
  const isDocumentValid = isValidCpfCnpj(cleanDocument);
  const documentWarning = hasDocumentInput && !isDocumentValid ? "CPF ou CNPJ inválido. Confira os dígitos informados." : "";
  const isPayerDataReady =
    form.customerName.trim().length > 0 &&
    form.customerEmail.trim().length > 0 &&
    isDocumentValid;
  const isCreditCardReady =
    isPayerDataReady &&
    cleanCardNumber.length === 16 &&
    form.holderName.trim().length > 0 &&
    hasValidExpiryFormat &&
    cleanCvv.length >= 3;

  const handleCopyPixPayload = async () => {
    if (!pixResult?.payload) return;

    try {
      await navigator.clipboard.writeText(pixResult.payload);
      toast({
        title: "Codigo Pix copiado",
        description: "O texto Copia e Cola foi enviado para a área de transferência.",
        variant: "success",
      });
    } catch {
      toast({
        title: "Falha ao copiar",
        description: "Não foi possível copiar o código Pix automaticamente.",
        variant: "destructive",
      });
    }
  };

  const runCheckout = async (method: PaymentMethod) => {
    setErrorMessage("");
    setPixResult(null);
    setCardResult(null);

    if (!user?.tenantId) {
      setErrorMessage("Loja não encontrada para o usuário logado.");
      return;
    }

    if (!selectedPlan) {
      setErrorMessage("Selecione um plano válido para continuar.");
      return;
    }

    const expiryMonth = cleanExpiry.slice(0, 2);
    const expiryYear = cleanExpiry.slice(2, 4);
    const fullExpiryYear = expiryYear ? `20${expiryYear}` : "";

    if (!isPayerDataReady) {
      setErrorMessage("Preencha nome, e-mail e CPF/CNPJ para continuar.");
      return;
    }

    if (method === "CREDIT_CARD" && cleanExpiry.length < 4) {
      setErrorMessage("Informe a validade do cartão no formato MM/AA.");
      return;
    }

    setIsSubmitting(true);

    try {
      const tenantUpdate = (supabase.from("tenants") as never as {
        update: (payload: {
          name: string;
          email: string;
          cpf_cnpj: string;
        }) => {
          eq: (column: string, value: string) => Promise<{ error: Error | null }>;
        };
      })
        .update({
          name: form.customerName.trim(),
          email: form.customerEmail.trim(),
          cpf_cnpj: cleanDocument.replace(/\D/g, ""),
        })
        .eq("id", user.tenantId);

      const { error: tenantUpdateError } = await tenantUpdate;

      if (tenantUpdateError) {
        throw tenantUpdateError;
      }

      const payload = {
        tenant_id: user.tenantId,
        plan_id: selectedPlan.id,
        billingType: method,
        customerData: {
          name: form.customerName.trim(),
          email: form.customerEmail.trim(),
          cpfCnpj: cleanDocument.replace(/\D/g, ""),
          phone: data?.tenant.phone ?? undefined,
        },
        ...(method === "CREDIT_CARD"
          ? {
              creditCard: {
                holderName: form.holderName.trim(),
                number: digitsOnly(form.cardNumber),
                expiryMonth,
                expiryYear: fullExpiryYear,
                ccv: digitsOnly(form.cvv),
              },
              creditCardHolderInfo: {
                name: form.customerName.trim(),
                email: form.customerEmail.trim(),
                cpfCnpj: cleanDocument.replace(/\D/g, ""),
                phone: data?.tenant.phone ?? undefined,
              },
            }
          : {}),
      };

      console.log("Payload enviado:", payload);

      const { data: response, error } = await supabase.functions.invoke<CheckoutFunctionResponse>("create-checkout", {
        body: payload,
        headers: {
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
      });

      console.log("Resposta do Asaas:", { data: response, error });

      if (error) {
        let functionMessage = getErrorMessage(error);
        const responseContext = (error as { context?: Response }).context;

        if (responseContext) {
          try {
            const contextPayload = await responseContext.json();
            if (contextPayload?.error) {
              functionMessage = contextPayload.error;
            }
          } catch {
            // Mantem a mensagem padrao do invoke.
          }
        }

        throw new Error(functionMessage);
      }

      if (!response) {
        throw new Error("A Edge Function não retornou dados.");
      }

      if (method === "PIX") {
        setPixResult(response);
        toast({
          title: "Pix gerado com sucesso",
          description: "Escaneie o QR Code ou copie o código para concluir a assinatura.",
          variant: "success",
        });
        return;
      }

      setCardResult(response);
      toast({
        title: "Pagamento aprovado",
        description: "Sua assinatura foi ativada. Redirecionando para o dashboard...",
        variant: "success",
      });
    } catch (error) {
      const message = "Erro ao processar pagamento. Verifique a integração.";
      setErrorMessage(message);
      toast({
        title: "Falha no checkout",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runCheckout(paymentMethod);
  };

  const handlePlanChange = (value: string) => {
    setSelectedPlanId(value);
    setErrorMessage("");
    setPixResult(null);
    setCardResult(null);
    setLastPixRequestKey("");
  };

  useEffect(() => {
    if (paymentMethod !== "PIX") {
      setLastPixRequestKey("");
      return;
    }

    if (!currentPixRequestKey || pixResult || isSubmitting || !selectedPlan || !isPayerDataReady) {
      return;
    }

    if (lastPixRequestKey === currentPixRequestKey) {
      return;
    }

    setLastPixRequestKey(currentPixRequestKey);
    void runCheckout("PIX");
  }, [currentPixRequestKey, isPayerDataReady, isSubmitting, lastPixRequestKey, paymentMethod, pixResult, selectedPlan]);

  return (
    <div className="min-h-full text-slate-900 dark:text-slate-50">
      <Header title="Checkout da Assinatura" />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="mt-2 text-3xl font-heading font-semibold text-slate-900 dark:text-slate-50">Atualize sua assinatura</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-zinc-400">
              Seus dados são protegidos pela tecnologia e segurança da Asaas.
            </p>
          </div>
        </div>

        {errorMessage && (
          <Alert variant="destructive" className="border-red-500/40 bg-red-500/10 text-red-500 dark:text-red-50">
            <AlertTitle>Falha ao processar o checkout</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {cardResult && (
            <Alert className="border-emerald-500/40 bg-emerald-500/10 text-emerald-50">
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
            <AlertTitle>Pagamento aprovado</AlertTitle>
            <AlertDescription>
              Status {getCheckoutStatusLabel(cardResult.status)}
              {cardResult.cardLast4 ? ` • Cartão final ${cardResult.cardLast4}` : ""}. Redirecionando...
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.05fr_1.45fr]">
          <Card className="border-slate-200/80 bg-white text-slate-900 shadow-xl shadow-slate-200/40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-slate-50 dark:shadow-black/30">
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="border-orange-500/50 bg-orange-500/20 text-orange-500 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-200">
                  Resumo do pedido
                </Badge>
              </div>
              <div>
                <CardTitle className="text-2xl">Sua próxima assinatura</CardTitle>
                <CardDescription className="mt-2 text-slate-600 dark:text-zinc-400">
                  Revise o plano e escolha como deseja pagar.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="plan-select" className="text-slate-700 dark:text-zinc-200">
                  Plano
                </Label>
                <Select value={selectedPlanId} onValueChange={handlePlanChange}>
                  <SelectTrigger id="plan-select" className="border-slate-300 bg-white text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
                    <SelectValue placeholder={isLoadingPlans ? "Carregando planos..." : "Selecione um plano"} />
                  </SelectTrigger>
                  <SelectContent className="border-slate-200 bg-white text-slate-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} • {formatCurrency(Number(plan.price))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-zinc-800 dark:bg-gradient-to-br dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">Plano selecionado</p>
                    <h3 className="mt-2 text-2xl font-semibold">{selectedPlan?.name ?? "Selecione um plano"}</h3>
                    <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
                      {selectedPlan?.description || "Escolha um plano para visualizar o resumo da assinatura."}
                    </p>
                  </div>
                  {selectedPlan ? (
                    <Badge className="bg-slate-900 text-white hover:bg-slate-900 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-100">{getPlanTypeLabel(selectedPlan.type)}</Badge>
                  ) : null}
                </div>

                <div className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 dark:border-zinc-800 dark:bg-black/20">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-500">Valor</p>
                    <p className="mt-1 text-3xl font-semibold text-orange-500">
                      {selectedPlan ? formatCurrency(Number(selectedPlan.price)) : "--"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-500">Ciclo</p>
                    <p className="mt-1 text-sm font-medium text-slate-900 dark:text-zinc-100">
                      {selectedPlan ? `Renova a cada ${selectedPlan.billing_days} dias` : "--"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
                <div className="space-y-4">
                  {trustSeals.map((seal) => (
                    <div key={seal.title} className="flex items-center gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-100/80 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300">
                        {seal.icon}
                      </div>
                      <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">{seal.title}</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-200 pt-5 dark:border-zinc-800">
                  <img src="/logos-checkout.svg" alt="Bandeiras de pagamento aceitas" className="h-auto max-h-10 w-full max-w-md object-contain" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 bg-white text-slate-900 shadow-xl shadow-slate-200/40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-slate-50 dark:shadow-black/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="mb-2 border-emerald-500/50 bg-emerald-500/20 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                  <ShieldCheck className="h-3.5 w-3.5" />
                    Checkout Seguro
                </Badge>
              </div>
             <CardTitle className="text-2xl">Pagamento</CardTitle>
              <CardDescription className="text-slate-600 dark:text-zinc-400">
                Informe os dados do pagador e escolha entre cartão de crédito ou Pix.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="customerName" className="text-slate-700 dark:text-zinc-200">
                      Nome completo
                    </Label>
                    <Input
                      id="customerName"
                      value={form.customerName}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          customerName: event.target.value,
                          holderName: prev.holderName || event.target.value,
                        }))
                      }
                      className="border-slate-300 bg-white text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                      placeholder="Nome do responsável financeiro"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customerEmail" className="text-slate-700 dark:text-zinc-200">
                      E-mail
                    </Label>
                    <Input
                      id="customerEmail"
                      type="email"
                      value={form.customerEmail}
                      onChange={(event) => setForm((prev) => ({ ...prev, customerEmail: event.target.value }))}
                      className="border-slate-300 bg-white text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                      placeholder="financeiro@loja.com"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cpfCnpj" className="text-slate-700 dark:text-zinc-200">
                      CPF ou CNPJ
                    </Label>
                    <Input
                      id="cpfCnpj"
                      value={form.cpfCnpj}
                      onChange={(event) => setForm((prev) => ({ ...prev, cpfCnpj: formatCpfCnpj(event.target.value) }))}
                      className="border-slate-300 bg-white text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                      placeholder="00.000.000/0000-00"
                      required
                    />
                    {documentWarning ? <p className="text-xs text-red-500 dark:text-red-400">{documentWarning}</p> : null}
                  </div>
                </div>

                <Tabs value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)} className="space-y-4">
                  <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1 dark:bg-zinc-900">
                    <TabsTrigger value="CREDIT_CARD" className="gap-2 text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-900 dark:text-zinc-300 dark:data-[state=active]:bg-zinc-50 dark:data-[state=active]:text-zinc-900">
                      <CreditCard className="h-4 w-4" />
                      Cartão de crédito
                    </TabsTrigger>
                    <TabsTrigger value="PIX" className="gap-2 text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-900 dark:text-zinc-300 dark:data-[state=active]:bg-zinc-50 dark:data-[state=active]:text-zinc-900">
                      <QrCode className="h-4 w-4" />
                      Pix
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="CREDIT_CARD" className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cardNumber" className="text-slate-700 dark:text-zinc-200">
                          Número do cartão
                        </Label>
                        <Input
                          id="cardNumber"
                          value={form.cardNumber}
                          onChange={(event) => setForm((prev) => ({ ...prev, cardNumber: formatCardNumber(event.target.value) }))}
                          className="border-slate-300 bg-white text-slate-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                          placeholder="0000 0000 0000 0000"
                          required={paymentMethod === "CREDIT_CARD"}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="holderName" className="text-slate-700 dark:text-zinc-200">
                          Nome impresso no cartão
                        </Label>
                        <Input
                          id="holderName"
                          value={form.holderName}
                          onChange={(event) => setForm((prev) => ({ ...prev, holderName: event.target.value }))}
                          className="border-slate-300 bg-white text-slate-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                          placeholder="Como aparece no cartão"
                          required={paymentMethod === "CREDIT_CARD"}
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                        <div className="space-y-2">
                          <Label htmlFor="expiry" className="text-slate-700 dark:text-zinc-200">
                            Validade
                          </Label>
                          <Input
                            id="expiry"
                            value={form.expiry}
                            onChange={(event) => setForm((prev) => ({ ...prev, expiry: formatExpiry(event.target.value) }))}
                            className="border-slate-300 bg-white text-slate-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                            placeholder="MM/AA"
                            required={paymentMethod === "CREDIT_CARD"}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="cvv" className="text-slate-700 dark:text-zinc-200">
                            CVV
                          </Label>
                          <Input
                            id="cvv"
                            value={form.cvv}
                            onChange={(event) => setForm((prev) => ({ ...prev, cvv: formatCvv(event.target.value) }))}
                            className="border-slate-300 bg-white text-slate-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                            placeholder="123"
                            required={paymentMethod === "CREDIT_CARD"}
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="PIX" className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
                    {!pixResult && (
                      <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-orange-500 dark:bg-orange-500/10 dark:text-orange-300">
                          <QrCode className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-base font-medium text-slate-900 dark:text-zinc-100">Gerando QR Code Pix</p>
                          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                            O código de pagamento aparece automaticamente assim que a integração responder.
                          </p>
                        </div>
                        {isSubmitting && (
                          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-4 py-2 text-sm text-slate-700 dark:border-orange-500/20 dark:bg-zinc-950 dark:text-zinc-200">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Processando pagamento...
                          </div>
                        )}
                      </div>
                    )}

                    {pixResult && (
                      <div className="grid gap-4 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-5 md:grid-cols-[220px_1fr]">
                        <div className="rounded-2xl bg-white p-4">
                          {pixImageSrc ? (
                            <img src={pixImageSrc} alt="QR Code Pix" className="mx-auto h-44 w-44 object-contain" />
                          ) : (
                            <div className="flex h-44 items-center justify-center text-center text-sm text-slate-500 dark:text-zinc-500">
                              QR Code indisponível
                            </div>
                          )}
                        </div>

                        <div className="space-y-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-emerald-200/80">Status do checkout</p>
                            <h3 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">{getCheckoutStatusLabel(pixResult.status)}</h3>
                            <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-100/80">
                              Compartilhe o QR Code ou o texto abaixo para concluir a cobrança.
                            </p>
                          </div>

                          <div className="rounded-2xl border border-emerald-500/20 bg-black/20 p-4">
                            <p className="mb-2 text-xs uppercase tracking-[0.16em] text-emerald-200/70">Pix Copia e Cola</p>
                            <Input readOnly value={pixResult.payload ?? ""} className="border-emerald-500/20 bg-white/90 text-slate-900 dark:bg-zinc-950 dark:text-zinc-50" />
                          </div>

                          <div className="flex flex-col gap-3 sm:flex-row">
                            <Button type="button" className="bg-emerald-500/10 text-zinc-950 hover:bg-emerald-400" onClick={handleCopyPixPayload}>
                              <Copy className="mr-2 h-4 w-4" />
                              Copiar código
                            </Button>
                            {pixResult.expirationDate && (
                              <div className="flex items-center text-sm text-emerald-100/80">
                                Expira em {new Date(pixResult.expirationDate).toLocaleString("pt-BR")}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>

                <div className="flex flex-col gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-slate-600 dark:text-zinc-400">
                    {selectedPlan ? (
                      <>
                        Você está contratando <span className="font-medium text-slate-900 dark:text-zinc-100">{selectedPlan.name}</span> por{" "}
                        <span className="font-medium text-orange-500">{formatCurrency(Number(selectedPlan.price))}</span>.
                      </>
                    ) : (
                      "Selecione um plano para continuar."
                    )}
                  </div>

                  {paymentMethod === "CREDIT_CARD" ? (
                    <Button
                      type="submit"
                      disabled={isSubmitting || isLoadingTenant || !selectedPlan || !isCreditCardReady}
                      className="min-w-[220px] bg-orange-500 text-white hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        "Finalizar pagamento"
                      )}
                    </Button>
                  ) : (
                    <div className="text-sm text-slate-600 dark:text-zinc-400">
                      {isSubmitting ? "Gerando QR Code Pix..." : "O QR Code é gerado automaticamente nesta aba."}
                    </div>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}



