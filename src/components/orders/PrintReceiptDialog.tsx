import React, { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { OrderReceipt } from "./OrderReceipt";
import { Printer } from "lucide-react";

interface PrintReceiptDialogProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
}

export function PrintReceiptDialog({
  open,
  onClose,
  orderId,
}: PrintReceiptDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContents = printRef.current?.innerHTML || "";

    // Criar um novo documento para impressão
    const printFrame = document.createElement("iframe");
    printFrame.style.position = "absolute";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document;
    if (!frameDoc) return;

    frameDoc.open();
    frameDoc.write(`
      <html>
        <head>
          <title>Comanda #${orderId}</title>
          <style>
            body {
              font-family: monospace;
              width: 80mm;
              margin: 0 auto;
              padding: 8mm;
              color: black;
              background-color: white;
              font-size: 12px;
              line-height: 1.4;
            }
            @page {
              size: 80mm auto;
              margin: 5mm;
              padding: 0mm;
            }
            .print-hidden {
              display: none !important;
            }
            div {
              margin-bottom: 2px;
            }
            .border-t {
              border-top: 1px dashed #000;
              margin: 10px 0;
              padding-top: 5px;
            }
            .font-bold {
              font-weight: bold;
            }
            .mb-1 { margin-bottom: 4px; }
            .mb-2 { margin-bottom: 8px; }
            .mb-3 { margin-bottom: 12px; }
            .mb-4 { margin-bottom: 16px; }
            .mb-5 { margin-bottom: 20px; }
            .mt-1 { margin-top: 4px; }
            .mt-2 { margin-top: 8px; }
            .mt-3 { margin-top: 12px; }
            .space-y-1 > * + * { margin-top: 4px; }
            .space-y-2 > * + * { margin-top: 8px; }
            
            /* Tailwind util classes used in OrderReceipt */
            .flex { display: flex; }
            .inline-flex { display: inline-flex; }
            .items-center { align-items: center; }
            .justify-between { justify-content: space-between; }
            .text-center { text-align: center; }
            .text-xl { font-size: 20px; line-height: 28px; }
            .text-xs { font-size: 10px; line-height: 14px; }
            .font-semibold { font-weight: 600; }
            .pl-4 { padding-left: 16px; }
            .pt-1 { padding-top: 4px; }
            .my-4 { margin-top: 16px; margin-bottom: 16px; }
            .my-5 { margin-top: 20px; margin-bottom: 20px; }
            .px-2 { padding-left: 8px; padding-right: 8px; }
            .py-0\\.5 { padding-top: 2px; padding-bottom: 2px; }
            .rounded-full { border-radius: 9999px; }
            .gap-1 { gap: 4px; }
            .w-full { width: 100%; }
            .w-\\[300px\\] { width: 300px; }
            .mr-1 { margin-right: 4px; }
            .border-dashed { border-style: dashed; }
            .leading-tight { line-height: 1.25; }
          </style>
        </head>
        <body>
          ${printContents}
        </body>
      </html>
    `);
    frameDoc.close();

    // Executar a impressão sincronicamente para evitar bloqueio de popups
    printFrame.contentWindow?.focus();
    printFrame.contentWindow?.print();
    
    // Remover o iframe depois de um tempo
    setTimeout(() => {
      try {
        if (document.body.contains(printFrame)) {
          document.body.removeChild(printFrame);
        }
      } catch (e) {
        // Ignore
      }
    }, 60000); // Remove after 1 minute to ensure print dialog has time to process
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[350px]">
        <DialogHeader>
          <DialogTitle>Imprimir Comanda</DialogTitle>
          <DialogDescription className="sr-only">
            Visualização do recibo para impressão
          </DialogDescription>
        </DialogHeader>
        <div className="bg-white rounded-lg">
          <div ref={printRef}>
            <OrderReceipt orderId={orderId} />
          </div>
          <div className="flex justify-end mt-4 print-hidden">
            <Button onClick={handlePrint} className="flex items-center gap-2">
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}



