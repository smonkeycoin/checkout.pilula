"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

type Props = {
  orderId: string;
  token: string;
};

const initial = {
  rfc: "",
  legalName: "",
  taxRegime: "",
  fiscalPostalCode: "",
  cfdiUse: "",
  invoiceEmail: "",
  website: ""
};

export function InvoiceForm({ orderId, token }: Props) {
  const [values, setValues] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/invoice-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, orderId, token })
      });
      const payload = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "No pudimos registrar la solicitud.");
      setMessage(payload.message || "Tu solicitud de factura fue recibida.");
      setValues(initial);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos registrar la solicitud.");
    } finally {
      setLoading(false);
    }
  }

  function update(name: keyof typeof initial, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  return (
    <form onSubmit={submit} className="mt-8 grid gap-4" noValidate>
      <div className="hidden">
        <label htmlFor="website">Sitio web</label>
        <input id="website" value={values.website} onChange={(event) => update("website", event.target.value)} tabIndex={-1} autoComplete="off" />
      </div>
      <Field label="RFC" name="rfc" value={values.rfc} onChange={update} autoComplete="off" />
      <Field label="Nombre o razón social" name="legalName" value={values.legalName} onChange={update} autoComplete="organization" />
      <Field label="Régimen fiscal" name="taxRegime" value={values.taxRegime} onChange={update} />
      <Field label="Código postal fiscal" name="fiscalPostalCode" value={values.fiscalPostalCode} onChange={update} inputMode="numeric" />
      <Field label="Uso CFDI" name="cfdiUse" value={values.cfdiUse} onChange={update} />
      <Field label="Correo para factura" name="invoiceEmail" value={values.invoiceEmail} onChange={update} type="email" autoComplete="email" />
      <button
        type="submit"
        disabled={loading}
        className="inline-flex min-h-11 items-center justify-center gap-2 bg-pilula-burgundy px-5 text-sm font-semibold text-white hover:bg-[#7A0A40] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {loading ? "Enviando solicitud..." : "Enviar solicitud de factura"}
      </button>
      {message ? <p className="border border-pilula-gold/30 p-4 text-sm text-pilula-ivory/80">{message}</p> : null}
      {error ? <p className="border border-pilula-burgundy/50 bg-pilula-burgundy/15 p-4 text-sm" role="alert">{error}</p> : null}
    </form>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  autoComplete,
  inputMode
}: {
  label: string;
  name: keyof typeof initial;
  value: string;
  onChange: (name: keyof typeof initial, value: string) => void;
  type?: string;
  autoComplete?: string;
  inputMode?: "numeric";
}) {
  return (
    <label className="grid gap-2 text-sm text-pilula-ivory/80" htmlFor={name}>
      {label}
      <input
        id={name}
        name={name}
        required
        type={type}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        autoComplete={autoComplete}
        inputMode={inputMode}
        className="min-h-11 border border-pilula-gold/25 bg-pilula-black px-3 text-pilula-ivory"
      />
    </label>
  );
}
