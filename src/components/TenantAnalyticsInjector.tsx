import { useEffect } from "react";
import { PublicTenant } from "@/hooks/usePublicTenant";

interface TenantAnalyticsInjectorProps {
  tenant: PublicTenant | null;
}

export function TenantAnalyticsInjector({ tenant }: TenantAnalyticsInjectorProps) {
  useEffect(() => {
    if (!tenant || !tenant.marketing_enabled) return;

    const { facebook_pixel_id, google_tag_id } = tenant;

    // Facebook Pixel
    if (facebook_pixel_id && !document.getElementById(`fb-pixel-${tenant.id}`)) {
      const fbScript = document.createElement("script");
      fbScript.id = `fb-pixel-${tenant.id}`;
      fbScript.innerHTML = `
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${facebook_pixel_id}');
        fbq('track', 'PageView');
      `;
      document.head.appendChild(fbScript);
      
      const fbNoscript = document.createElement("noscript");
      fbNoscript.id = `fb-pixel-noscript-${tenant.id}`;
      fbNoscript.innerHTML = `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${facebook_pixel_id}&ev=PageView&noscript=1" />`;
      document.head.appendChild(fbNoscript);
    }

    // Google Tag
    if (google_tag_id && !document.getElementById(`google-tag-${tenant.id}`)) {
      const gtmScript = document.createElement("script");
      gtmScript.id = `google-tag-${tenant.id}`;
      gtmScript.async = true;
      gtmScript.src = `https://www.googletagmanager.com/gtag/js?id=${google_tag_id}`;
      document.head.appendChild(gtmScript);

      const gtmInitScript = document.createElement("script");
      gtmInitScript.id = `google-tag-init-${tenant.id}`;
      gtmInitScript.innerHTML = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${google_tag_id}');
      `;
      document.head.appendChild(gtmInitScript);
    }
    
    return () => {
      // Limpeza opcional se o usuário mudar de tenant na mesma sessão, 
      // mas geralmente num SPA o ideal é deixar ou limpar os scripts específicos se houver muita troca.
      // Aqui manteremos os scripts para evitar erros do gtag/fbq ao remover a tag do DOM.
    };
  }, [tenant]);

  return null;
}
