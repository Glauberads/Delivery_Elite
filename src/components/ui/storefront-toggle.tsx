import * as React from "react";
import { Store } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function StorefrontToggle() {
  const { user } = useAuth();
  const [slug, setSlug] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    const loadTenantSlug = async () => {
      if (!user?.tenantId) {
        setSlug(null);
        return;
      }

      setIsLoading(true);

      try {
        const { data, error } = await supabase
          .from("tenants")
          .select("slug")
          .eq("id", user.tenantId)
          .maybeSingle();

        if (error) throw error;
        setSlug(data?.slug ?? null);
      } catch (error) {
        console.error("Error loading tenant slug:", error);
        setSlug(null);
      } finally {
        setIsLoading(false);
      }
    };

    void loadTenantSlug();
  }, [user?.tenantId]);

  const handleOpenStorefront = () => {
    if (!slug) return;

    const storefrontUrl = `${window.location.origin}/r/${slug}`;
    window.open(storefrontUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Button
      type="button"
      size="icon"
      onClick={handleOpenStorefront}
      disabled={isLoading || !slug}
      className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 dark:bg-red-600 dark:hover:bg-red-700"
    >
      <Store className="h-[1.2rem] w-[1.2rem]" />
      <span className="sr-only">Abrir cardápio da loja</span>
    </Button>
  );
}



