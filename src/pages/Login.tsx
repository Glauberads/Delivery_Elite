import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { digitsOnly, formatCpfCnpj, isValidCpfCnpj } from "@/lib/cpf-cnpj";
import { formatWhatsapp, isValidWhatsapp } from "@/lib/phone";

export default function Login() {
  const [searchParams] = useSearchParams();
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [storeName, setStoreName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [signupEnabled, setSignupEnabled] = useState(true);
  const { login, signup, user, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const initialTab = useMemo(() => {
    const requestedTab = String(searchParams.get("tab") ?? "").toLowerCase();
    return requestedTab === "signup" ? "signup" : "login";
  }, [searchParams]);
  const fromLandingSignup = String(searchParams.get("from") ?? "").toLowerCase() === "landing" && initialTab === "signup";

  const cleanCpfCnpj = digitsOnly(cpfCnpj);
  const cleanWhatsapp = digitsOnly(whatsapp);
  const hasCpfCnpjInput = cleanCpfCnpj.length > 0;
  const hasWhatsappInput = cleanWhatsapp.length > 0;
  const isSignupDocumentValid = isValidCpfCnpj(cleanCpfCnpj);
  const isSignupWhatsappValid = isValidWhatsapp(whatsapp);
  const signupDocumentError = hasCpfCnpjInput && !isSignupDocumentValid
    ? "Informe um CPF ou CNPJ valido para continuar."
    : "";
  const signupWhatsappError = hasWhatsappInput && !isSignupWhatsappValid
    ? "Informe um WhatsApp valido para continuar."
    : "";
  const isSignupFormValid =
    fullName.trim().length >= 3 &&
    storeName.trim().length >= 2 &&
    /^\S+@\S+\.\S+$/.test(signupEmail.trim()) &&
    signupPassword.length >= 6 &&
    isSignupDocumentValid &&
    isSignupWhatsappValid;

  useEffect(() => {
    const loadSignupFlag = () => {
      try {
        const stored = localStorage.getItem("signupEnabled");
        setSignupEnabled(stored === null ? true : stored === "true");
      } catch (_) {
        setSignupEnabled(true);
      }
    };
    loadSignupFlag();

    const onStorage = (e: StorageEvent) => {
      if (e.key === "signupEnabled") {
        loadSignupFlag();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (isAuthLoading || !user) {
      return;
    }

    if (fromLandingSignup) {
      return;
    }

    if (user.isSuperAdmin) {
      navigate("/superadmin/dashboard", { replace: true });
      return;
    }

    navigate(
      user.needsOnboarding
        ? "/admin/profile?tab=profile&onboarding=complete"
        : "/dashboard",
      { replace: true }
    );
  }, [fromLandingSignup, isAuthLoading, navigate, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await login(loginEmail, loginPassword);
    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignupFormValid) return;
    setIsLoading(true);
    await signup(
      signupEmail.trim(),
      signupPassword,
      fullName,
      cleanCpfCnpj,
      storeName.trim(),
      cleanWhatsapp
    );
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md lg:max-w-[32rem]">
        <div className="text-center mb-2">
          <div className="flex items-center justify-center gap-3 mx-auto mb-4">
            <img
              src="/icon.svg"
              alt="VIP Delivery"
              className="h-10 w-10 object-contain shadow-lg transition-all duration-300 group-hover:scale-105 sm:h-12 sm:w-12"
            />
            <h1 className="text-[1.5rem] font-bold sm:text-3xl">VIP Delivery</h1>
          </div>
        </div>

        <Card className="lg:rounded-xl">
          <CardHeader>
            <CardTitle>Acesso ao Sistema</CardTitle>
            <CardDescription>
              Entre em sua conta, ou cadastre-se.
            </CardDescription>
          </CardHeader>

          <Tabs defaultValue={initialTab}>
            <TabsList className={`grid w-full ${signupEnabled ? "grid-cols-2" : "grid-cols-1"}`}>
              <TabsTrigger value="login">Login</TabsTrigger>
              {signupEnabled && <TabsTrigger value="signup">Cadastro</TabsTrigger>}
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                    />
                    <div className="pt-1 text-right">
                      <Link to="/forgot-password" className="text-sm text-gray-400 transition-colors hover:text-orange-500">
                        Esqueci minha senha?
                      </Link>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    type="submit"
                    className="w-full delivery-gradient"
                    disabled={isLoading}
                  >
                    {isLoading ? "Entrando..." : "Entrar"}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>

            {signupEnabled && (
              <TabsContent value="signup">
                <form onSubmit={handleSignup}>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Nome Completo</Label>
                        <Input
                          id="fullName"
                          type="text"
                          placeholder="Seu nome completo"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cpfCnpj">CPF ou CNPJ</Label>
                        <Input
                          id="cpfCnpj"
                          type="text"
                          inputMode="numeric"
                          maxLength={18}
                          placeholder="000.000.000-00"
                          value={cpfCnpj}
                          onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))}
                          required
                        />
                        {signupDocumentError ? <p className="text-xs text-red-500">{signupDocumentError}</p> : null}
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="storeName">Nome da Loja</Label>
                        <Input
                          id="storeName"
                          type="text"
                          placeholder="Nome da sua loja"
                          value={storeName}
                          onChange={(e) => setStoreName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="whatsapp">WhatsApp</Label>
                        <Input
                          id="whatsapp"
                          type="text"
                          inputMode="numeric"
                          placeholder="(11) 99999-9999"
                          value={whatsapp}
                          onChange={(e) => setWhatsapp(formatWhatsapp(e.target.value))}
                          required
                        />
                        {signupWhatsappError ? <p className="text-xs text-red-500">{signupWhatsappError}</p> : null}
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="signup-email">E-mail</Label>
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="seu@email.com"
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-password">Senha</Label>
                        <Input
                          id="signup-password"
                          type="password"
                          placeholder="••••••••"
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      type="submit"
                      className="w-full delivery-gradient"
                      disabled={isLoading || !isSignupFormValid}
                    >
                      {isLoading ? "Criando conta..." : "Criar Conta"}
                    </Button>
                  </CardFooter>
                </form>
              </TabsContent>
            )}
          </Tabs>
        </Card>
      </div>
    </div>
  );
}



