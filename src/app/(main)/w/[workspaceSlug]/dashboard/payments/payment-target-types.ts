export type PaymentTargetKind = "deposit" | "invoice_payment";

export type PreviousPaymentOption = {
  amount: string;
  id: string;
  method: string;
  paidOn: string;
  paymentType: string;
  referenceNumber?: string;
  status: string;
};

export type PaymentInvoiceOption = {
  amountPaid: string;
  balanceDue: string;
  customerName: string;
  dueAt: string;
  finalCost: string;
  id: string;
  invoiceNumber: string;
  issuedAt: string;
  jobId: string;
  jobTitle: string;
  paymentCount: number;
  payments: PreviousPaymentOption[];
};

export type PaymentJobOption = {
  amountPaid: string;
  customerName: string;
  depositPaid: string;
  description: string;
  estimatedCost?: string;
  finalCost?: string;
  id: string;
  invoiceBalanceDue?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  paymentCount: number;
  payments: PreviousPaymentOption[];
  serviceLocation?: string;
  status: string;
};

export type PaymentTargetSearchResult = {
  invoices: PaymentInvoiceOption[];
  jobs: PaymentJobOption[];
  message: string;
  page: number;
  success: boolean;
  total: number;
  totalPages: number;
};

export type PaymentTargetDetailsResult = {
  invoice: PaymentInvoiceOption | null;
  job: PaymentJobOption | null;
  message: string;
  success: boolean;
};

export type SearchPaymentTargetsAction = (input: {
  kind: PaymentTargetKind;
  page: number;
  query: string;
}) => Promise<PaymentTargetSearchResult>;

export type GetPaymentTargetDetailsAction = (input: {
  id: string;
  kind: PaymentTargetKind;
}) => Promise<PaymentTargetDetailsResult>;
