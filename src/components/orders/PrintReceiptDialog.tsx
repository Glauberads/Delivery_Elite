import React, { useRef, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { OrderReceipt } from "./OrderReceipt";
import { Printer, Settings2 } from "lucide-react";

interface PrintReceiptDialogProps {
  open: boolean;
  onClose: () => void;
  orderId: string | null;
}

export function PrintReceiptDialog({
  open,
  onClose,
  orderId,
}: PrintReceiptDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);

  // Recupera preferências salvas ou usa 58mm / large por padrão
  const [paperWidth, setPaperWidth] = useState<"58mm" | "80mm">(() => {
    const saved = localStorage.getItem("deliverymax_printer_width");
    return saved === "80mm" ? "80mm" : "58mm";
  });

  const [fontSize, setFontSize] = useState<"normal" | "large" | "xlarge">(() => {
    const saved = localStorage.getItem("deliverymax_printer_font_size");
    if (saved === "normal" || saved === "xlarge") return saved;
    return "large";
  });

  const [showSettings, setShowSettings] = useState(false);

  // Salvar preferências no localStorage
  const handlePaperWidthChange = (width: "58mm" | "80mm") => {
    setPaperWidth(width);
    localStorage.setItem("deliverymax_printer_width", width);
  };

  const handleFontSizeChange = (size: "normal" | "large" | "xlarge") => {
    setFontSize(size);
    localStorage.setItem("deliverymax_printer_font_size", size);
  };

  const handlePrint = () => {
    const printContents = printRef.current?.innerHTML || "";

    // Limpar iframe antigo se existir
    const existingFrame = document.getElementById("print-iframe");
    if (existingFrame) {
      existingFrame.remove();
    }

    const printFrame = document.createElement("iframe");
    printFrame.id = "print-iframe";
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "200px";
    printFrame.style.height = "200px";
    printFrame.style.border = "0";
    printFrame.style.opacity = "0";
    printFrame.style.pointerEvents = "none";
    printFrame.style.zIndex = "-1000";
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document;
    if (!frameDoc) return;

    // Configuração de medidas por bobina
    const is58mm = paperWidth === "58mm";
    const printWidth = is58mm ? "48mm" : "72mm";
    const pageSize = is58mm ? "58mm auto" : "80mm auto";

    // Tamanhos de fonte em pixels para a impressão térmica
    const fontSizes = {
      normal: {
        root: "13px",
        title: "17px",
        orderNum: "15px",
        total: "16px",
        badge: "11px",
        small: "11px",
      },
      large: {
        root: "15px",
        title: "20px",
        orderNum: "18px",
        total: "19px",
        badge: "12px",
        small: "12px",
      },
      xlarge: {
        root: "17px",
        title: "22px",
        orderNum: "20px",
        total: "21px",
        badge: "13px",
        small: "13px",
      },
    }[fontSize];

    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Comanda #${orderId}</title>
          <style>
            @page {
              size: ${pageSize};
              margin: 0mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            html, body {
              width: 100%;
              margin: 0;
              padding: 0;
              background-color: #ffffff;
              color: #000000;
              font-family: 'Courier New', Courier, 'Lucida Console', Monaco, monospace;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: flex-start;
              font-size: ${fontSizes.root};
              line-height: 1.3;
              font-weight: 600;
            }
            .receipt-wrapper {
              width: ${printWidth} !important;
              max-width: ${printWidth} !important;
              margin: 0 auto !important;
              padding: 2mm 0.5mm 5mm 0.5mm !important;
              box-sizing: border-box !important;
              text-align: left;
            }

            /* Utilitários Flex e alinhamento */
            .flex { display: flex !important; }
            .inline-flex { display: inline-flex !important; }
            .items-center { align-items: center !important; }
            .items-start { align-items: flex-start !important; }
            .justify-between { justify-content: space-between !important; }
            .justify-center { justify-content: center !important; }
            .text-center { text-align: center !important; }
            .text-right { text-align: right !important; }
            .text-left { text-align: left !important; }
            .flex-1 { flex: 1 1 0% !important; }
            .shrink-0 { flex-shrink: 0 !important; }
            .break-words { word-break: break-word !important; }
            .whitespace-nowrap { white-space: nowrap !important; }

            /* Tipografia */
            .font-bold { font-weight: 700 !important; }
            .font-black { font-weight: 900 !important; }
            .font-semibold { font-weight: 600 !important; }
            .uppercase { text-transform: uppercase !important; }
            .italic { font-style: italic !important; }

            /* Tamanhos ajustados para impressão */
            .text-xl { font-size: ${fontSizes.title} !important; font-weight: 900 !important; }
            .text-2xl { font-size: ${fontSizes.title} !important; font-weight: 900 !important; }
            .text-lg { font-size: ${fontSizes.orderNum} !important; font-weight: 800 !important; }
            .text-base { font-size: ${fontSizes.root} !important; }
            .text-sm { font-size: ${fontSizes.root} !important; }
            .text-xs { font-size: ${fontSizes.small} !important; }

            /* Bordas e divisores para impressoras térmicas */
            .border-t-2 { border-top: 1.5px dashed #000 !important; }
            .border-b { border-bottom: 1px solid #000 !important; }
            .border-2 { border: 1.5px solid #000 !important; }
            .border { border: 1px solid #000 !important; }
            .border-dashed { border-style: dashed !important; }
            .rounded { border-radius: 3px !important; }

            /* Espaçamentos */
            .p-1 { padding: 4px !important; }
            .p-2 { padding: 6px !important; }
            .px-1\\.5 { padding-left: 6px !important; padding-right: 6px !important; }
            .py-0\\.5 { padding-top: 2px !important; padding-bottom: 2px !important; }
            .pt-1 { padding-top: 4px !important; }
            .pt-1\\.5 { padding-top: 6px !important; }
            .pt-2 { padding-top: 8px !important; }
            .pb-1 { padding-bottom: 4px !important; }
            .pl-3 { padding-left: 10px !important; }
            .pr-1 { padding-right: 4px !important; }
            .mb-1 { margin-bottom: 3px !important; }
            .mb-2 { margin-bottom: 6px !important; }
            .mb-3 { margin-bottom: 8px !important; }
            .mb-4 { margin-bottom: 10px !important; }
            .mt-1 { margin-top: 3px !important; }
            .mt-2 { margin-top: 6px !important; }
            .mt-3 { margin-top: 8px !important; }
            .mt-4 { margin-top: 10px !important; }
            .my-1 { margin-top: 3px !important; margin-bottom: 3px !important; }
            .my-2 { margin-top: 6px !important; margin-bottom: 6px !important; }
            .my-3 { margin-top: 8px !important; margin-bottom: 8px !important; }
            .my-4 { margin-top: 10px !important; margin-bottom: 10px !important; }
            .space-y-1 > * + * { margin-top: 3px !important; }

            /* Código de barras */
            canvas, img {
              display: block !important;
              margin: 4px auto !important;
              max-width: 100% !important;
              height: auto !important;
            }

            .print-hidden {
              display: none !important;
            }
          </style>
        </head>
        <body>
          ${printContents}
        </body>
      </html>
    `);
    frameDoc.close();

    // Executa a impressão
    printFrame.contentWindow?.focus();
    printFrame.contentWindow?.print();
  };

  if (!orderId) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[420px] max-h-[95vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="pb-2 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Printer className="h-5 w-5 text-primary" />
              Imprimir Comanda
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Settings2 className="h-4 w-4 mr-1" />
              Configurar
            </Button>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Otimizado para bobina térmica de 58 mm centralizada e com fonte nítida.
          </DialogDescription>
        </DialogHeader>

        {/* Painel de Configurações da Impressora */}
        {showSettings && (
          <div className="bg-muted/60 p-3 rounded-lg my-2 text-xs space-y-3 border">
            <div>
              <span className="font-semibold block mb-1.5 text-foreground">
                Largura da Bobina / Papel:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={paperWidth === "58mm" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePaperWidthChange("58mm")}
                  className="h-8 text-xs font-bold"
                >
                  58 mm (Maquininha)
                </Button>
                <Button
                  type="button"
                  variant={paperWidth === "80mm" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePaperWidthChange("80mm")}
                  className="h-8 text-xs"
                >
                  80 mm (Padrão)
                </Button>
              </div>
            </div>

            <div>
              <span className="font-semibold block mb-1.5 text-foreground">
                Tamanho da Fonte:
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                <Button
                  type="button"
                  variant={fontSize === "normal" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleFontSizeChange("normal")}
                  className="h-8 text-xs"
                >
                  Normal
                </Button>
                <Button
                  type="button"
                  variant={fontSize === "large" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleFontSizeChange("large")}
                  className="h-8 text-xs font-bold"
                >
                  Grande ⭐
                </Button>
                <Button
                  type="button"
                  variant={fontSize === "xlarge" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleFontSizeChange("xlarge")}
                  className="h-8 text-xs"
                >
                  Muito Grande
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Visualização Prévia do Recibo */}
        <div className="flex-1 overflow-y-auto my-2 bg-slate-100 dark:bg-slate-900/50 p-3 rounded-lg border flex justify-center items-start">
          <div
            ref={printRef}
            className="bg-white text-black shadow-md border rounded p-1"
          >
            <OrderReceipt
              orderId={orderId}
              paperWidth={paperWidth}
              fontSize={fontSize}
            />
          </div>
        </div>

        {/* Barra de Ações */}
        <div className="pt-2 border-t flex items-center justify-between gap-2 flex-shrink-0">
          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <span>Bobina: <strong>{paperWidth}</strong></span>
            <span>•</span>
            <span>Fonte: <strong>{fontSize === "large" ? "Grande" : fontSize === "xlarge" ? "Muito Grande" : "Normal"}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={handlePrint}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-4 flex items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
