import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export function AnalyticsInjector() {
  const injected = useRef(false);

  useEffect(() => {
    if (injected.current) return;

    const fetchAnalyticsTags = async () => {
      try {
        const { data, error } = await supabase
          .from("platform_settings")
          .select("key, value")
          .in("key", ["facebook_pixel_id", "google_tag_id"]);

        if (error || !data) return;

        const fbPixel = data.find((item) => item.key === "facebook_pixel_id")?.value;
        const gTag = data.find((item) => item.key === "google_tag_id")?.value;

        // Injetar Facebook Pixel
        if (fbPixel && !document.getElementById("fb-pixel-script")) {
          const fbScript = document.createElement("script");
          fbScript.id = "fb-pixel-script";
          fbScript.innerHTML = `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${fbPixel}');
            fbq('track', 'PageView');
          `;
          document.head.appendChild(fbScript);
          
          const fbNoscript = document.createElement("noscript");
          fbNoscript.id = "fb-pixel-noscript";
          fbNoscript.innerHTML = `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${fbPixel}&ev=PageView&noscript=1" />`;
          document.head.appendChild(fbNoscript);
        }

        // Injetar Google Tag
        if (gTag && !document.getElementById("google-tag-script")) {
          const gtmScript = document.createElement("script");
          gtmScript.id = "google-tag-script";
          gtmScript.async = true;
          gtmScript.src = `https://www.googletagmanager.com/gtag/js?id=${gTag}`;
          document.head.appendChild(gtmScript);

          const gtmInitScript = document.createElement("script");
          gtmInitScript.id = "google-tag-init";
          gtmInitScript.innerHTML = `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gTag}');
          `;
          document.head.appendChild(gtmInitScript);
        }
        
        injected.current = true;
      } catch (err) {
        console.error("Erro ao injetar tags de analytics:", err);
      }
    };

    void fetchAnalyticsTags();
  }, []);

  return null;
}
