import React from "react";
import { cn } from "@/lib/utils";
import {
  CreditCard,
  Banknote,
  QrCode,
  Landmark,
  Wallet,
  Check,
  Plus,
  Minus,
  HelpCircle,
} from "lucide-react";

// Definição do tipo para os nomes dos ícones
export type IconName =
  | "credit-card"
  | "banknote"
  | "qr-code"
  | "landmark"
  | "wallet"
  | "check"
  | "plus"
  | "minus";

// Mapeamento dos nomes dos ícones para os componentes Lucide
const iconMap = {
  "credit-card": CreditCard,
  banknote: Banknote,
  "qr-code": QrCode,
  landmark: Landmark,
  wallet: Wallet,
  check: Check,
  plus: Plus,
  minus: Minus,
};

// Props para o componente Icon
interface IconProps {
  name: IconName | string;
  className?: string;
}

export function Icon({ name, className }: IconProps) {
  // Verificar se o nome do ícone existe no mapeamento
  const IconComponent = iconMap[name as IconName] || HelpCircle;

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <IconComponent className="h-full w-full" />
    </div>
  );
}



