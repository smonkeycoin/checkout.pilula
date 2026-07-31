export type InvoiceProviderRequest = {
  orderId: string;
  rfc: string;
  legalName: string;
  taxRegime: string;
  fiscalPostalCode: string;
  cfdiUse: string;
  invoiceEmail: string;
};

export type InvoiceProviderResult = {
  externalId: string;
  status: "queued" | "issued" | "failed";
};

export interface InvoicingProvider {
  requestInvoice(input: InvoiceProviderRequest): Promise<InvoiceProviderResult>;
}

export class ManualInvoicingProvider implements InvoicingProvider {
  async requestInvoice(): Promise<InvoiceProviderResult> {
    return {
      externalId: "manual-review",
      status: "queued"
    };
  }
}

// Future PAC integration point:
// Replace ManualInvoicingProvider with an adapter for Facturapi, Finkok, or another PAC.
// Keep CFDI credentials in environment variables and never expose them to the browser.
