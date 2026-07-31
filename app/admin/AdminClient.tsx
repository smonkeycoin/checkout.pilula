"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Row = Record<string, unknown>;

function useSupabase() {
  return useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    return url && anon ? createClient(url, anon) : null;
  }, []);
}

export function AdminNav() {
  return (
    <nav className="flex flex-wrap gap-3 text-sm text-pilula-ivory/75">
      <Link className="border border-pilula-gold/25 px-3 py-2 hover:text-pilula-gold" href="/admin">Panel</Link>
      <Link className="border border-pilula-gold/25 px-3 py-2 hover:text-pilula-gold" href="/admin/invitaciones">Invitaciones</Link>
      <Link className="border border-pilula-gold/25 px-3 py-2 hover:text-pilula-gold" href="/admin/pagos">Pagos</Link>
      <Link className="border border-pilula-gold/25 px-3 py-2 hover:text-pilula-gold" href="/admin/facturas">Facturas</Link>
      <Link className="border border-pilula-gold/25 px-3 py-2 hover:text-pilula-gold" href="/admin/configuracion/precios">Precios</Link>
    </nav>
  );
}

export function AdminLogin() {
  const supabase = useSupabase();
  const [email, setEmail] = useState("pilulamedplanner@gmail.com");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setMessage("Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/admin` }
    });
    setMessage(error ? "No se pudo enviar el magic link." : "Revisa tu correo para abrir el panel.");
  }

  return (
    <form onSubmit={submit} className="mt-8 grid max-w-md gap-4">
      <label className="grid gap-2 text-sm">
        Correo autorizado
        <input className="min-h-11 border border-pilula-gold/25 bg-pilula-black px-3" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <button className="min-h-11 bg-pilula-burgundy px-5 text-sm font-semibold text-white">Enviar magic link</button>
      {message ? <p className="text-sm text-pilula-ivory/75">{message}</p> : null}
    </form>
  );
}

async function authHeader(supabase: SupabaseClient | null): Promise<Record<string, string>> {
  const session = await supabase?.auth.getSession();
  const token = session?.data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function InvitationsAdmin() {
  const supabase = useSupabase();
  const [rows, setRows] = useState<Row[]>([]);
  const [createdUrl, setCreatedUrl] = useState("");
  const [form, setForm] = useState({
    profileType: "doctor",
    market: "mexico",
    paymentCurrency: "mxn",
    allowedPaymentMethods: "card_and_bank_transfer",
    exchangeRate: "",
    fullName: "",
    email: "",
    whatsapp: "",
    expiresAt: new Date(Date.now() + 7 * 24 * 3600_000).toISOString().slice(0, 16),
    approved: true,
    sendEmail: false
  });

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/invites", { headers: await authHeader(supabase) });
    if (response.ok) setRows(((await response.json()) as { invites: Row[] }).invites || []);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/admin/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader(supabase)) },
      body: JSON.stringify({ ...form, expiresAt: new Date(form.expiresAt).toISOString() })
    });
    if (response.ok) {
      const payload = (await response.json()) as { url: string };
      setCreatedUrl(payload.url);
      await load();
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={create} className="grid gap-4 border border-pilula-gold/25 p-5 md:grid-cols-2">
        <select className="min-h-11 bg-pilula-black px-3" value={form.profileType} onChange={(event) => setForm({ ...form, profileType: event.target.value })}>
          <option value="doctor">Doctor</option>
          <option value="patient">Paciente</option>
        </select>
        <select className="min-h-11 bg-pilula-black px-3" value={form.market} onChange={(event) => setForm({ ...form, market: event.target.value })}>
          <option value="mexico">México</option>
          <option value="international">Internacional</option>
        </select>
        <select className="min-h-11 bg-pilula-black px-3" value={form.paymentCurrency} onChange={(event) => setForm({ ...form, paymentCurrency: event.target.value })}>
          <option value="mxn">MXN</option>
          <option value="usd">USD</option>
        </select>
        <select className="min-h-11 bg-pilula-black px-3" value={form.allowedPaymentMethods} onChange={(event) => setForm({ ...form, allowedPaymentMethods: event.target.value })}>
          <option value="card">Solo tarjeta</option>
          <option value="bank_transfer">Solo SPEI</option>
          <option value="card_and_bank_transfer">Tarjeta y SPEI</option>
        </select>
        <input className="min-h-11 bg-pilula-black px-3" placeholder="Tipo de cambio MXN por USD" value={form.exchangeRate} onChange={(event) => setForm({ ...form, exchangeRate: event.target.value })} />
        <input className="min-h-11 bg-pilula-black px-3" placeholder="Nombre" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
        <input className="min-h-11 bg-pilula-black px-3" placeholder="Correo" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        <input className="min-h-11 bg-pilula-black px-3" placeholder="WhatsApp" value={form.whatsapp} onChange={(event) => setForm({ ...form, whatsapp: event.target.value })} />
        <input className="min-h-11 bg-pilula-black px-3" type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.approved} onChange={(event) => setForm({ ...form, approved: event.target.checked })} /> Aprobar</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.sendEmail} onChange={(event) => setForm({ ...form, sendEmail: event.target.checked })} /> Enviar email con Resend</label>
        <button className="min-h-11 bg-pilula-burgundy px-5 text-sm font-semibold text-white">Crear invitación</button>
      </form>
      {createdUrl ? (
        <div className="border border-pilula-gold/25 p-4 text-sm">
          <p>Enlace generado:</p>
          <p className="break-all text-pilula-gold">{createdUrl}</p>
          <button className="mt-3 border border-pilula-gold/30 px-3 py-2" onClick={() => navigator.clipboard.writeText(createdUrl)}>Copiar enlace</button>
        </div>
      ) : null}
      <InvitesTable rows={rows} onRefresh={load} onCreatedUrl={setCreatedUrl} />
    </div>
  );
}

function InvitesTable({ rows, onRefresh, onCreatedUrl }: { rows: Row[]; onRefresh: () => Promise<void>; onCreatedUrl: (url: string) => void }) {
  const supabase = useSupabase();
  async function action(id: string, actionName: string) {
    const response = await fetch(`/api/admin/invites/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await authHeader(supabase)) },
      body: JSON.stringify({ action: actionName, sendEmail: actionName === "resend" })
    });
    if (response.ok) {
      const payload = (await response.json()) as { url?: string; whatsappUrl?: string };
      if (payload.url) onCreatedUrl(payload.url);
      if (payload.whatsappUrl) window.open(payload.whatsappUrl, "_blank", "noopener,noreferrer");
      await onRefresh();
    }
  }

  if (rows.length === 0) return <p className="text-sm text-pilula-ivory/65">Sin invitaciones o sesión no autorizada.</p>;
  return (
    <div className="overflow-x-auto border border-pilula-gold/20">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="bg-pilula-charcoal text-pilula-gold">
          <tr><th className="px-3 py-2">nombre</th><th className="px-3 py-2">email</th><th className="px-3 py-2">perfil</th><th className="px-3 py-2">status</th><th className="px-3 py-2">expira</th><th className="px-3 py-2">acciones</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-t border-pilula-gold/10" key={String(row.id)}>
              <td className="px-3 py-2">{String(row.full_name || "")}</td>
              <td className="px-3 py-2">{String(row.email || "")}</td>
              <td className="px-3 py-2">{String(row.profile_type || "")}</td>
              <td className="px-3 py-2">{String(row.status || "")}</td>
              <td className="px-3 py-2">{String(row.expires_at || "")}</td>
              <td className="flex flex-wrap gap-2 px-3 py-2">
                <button className="border border-pilula-gold/25 px-2 py-1" onClick={() => action(String(row.id), "approve")}>Aprobar</button>
                <button className="border border-pilula-gold/25 px-2 py-1" onClick={() => action(String(row.id), "resend")}>Reenviar</button>
                <button className="border border-pilula-gold/25 px-2 py-1" onClick={() => action(String(row.id), "revoke")}>Revocar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminData({ endpoint, csvPath, label }: { endpoint: string; csvPath: string; label: string }) {
  const supabase = useSupabase();
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    async function load() {
      const response = await fetch(endpoint, { headers: await authHeader(supabase) });
      if (response.ok) {
        const payload = (await response.json()) as Record<string, Row[]>;
        setRows(Object.values(payload)[0] || []);
      }
    }
    void load();
  }, [endpoint, supabase]);

  return (
    <div className="space-y-5">
      <FilterBar filter={filter} setFilter={setFilter} />
      <ExportButton endpoint={csvPath} filename={`${label}-pilula.csv`} label={label} />
      <DataTable rows={filterRows(rows, filter)} />
    </div>
  );
}

function FilterBar({ filter, setFilter }: { filter: string; setFilter: (value: string) => void }) {
  const filters = ["", "usd", "mxn", "card", "bank_transfer", "awaiting_bank_transfer", "partially_funded", "paid", "expired", "requires_manual_review"];
  return (
    <select className="min-h-11 border border-pilula-gold/25 bg-pilula-black px-3 text-sm" value={filter} onChange={(event) => setFilter(event.target.value)}>
      {filters.map((item) => <option key={item || "all"} value={item}>{item || "Todos"}</option>)}
    </select>
  );
}

function filterRows(rows: Row[], filter: string) {
  if (!filter) return rows;
  return rows.filter((row) => Object.values(row).some((value) => String(value).toLowerCase() === filter));
}

export function InvoicesAdmin() {
  const supabase = useSupabase();
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/invoices", { headers: await authHeader(supabase) });
    if (response.ok) setRows(((await response.json()) as { invoices: Row[] }).invoices || []);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(id: string, status: string) {
    await fetch("/api/admin/invoices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await authHeader(supabase)) },
      body: JSON.stringify({ id, status })
    });
    await load();
  }

  return (
    <div className="space-y-5">
      <ExportButton endpoint="/api/admin/invoices?format=csv" filename="facturas-pilula.csv" label="facturas" />
      <div className="overflow-x-auto border border-pilula-gold/20">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-pilula-charcoal text-pilula-gold">
            <tr><th className="px-3 py-2">id</th><th className="px-3 py-2">order_id</th><th className="px-3 py-2">rfc</th><th className="px-3 py-2">email</th><th className="px-3 py-2">status</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-t border-pilula-gold/10" key={String(row.id)}>
                <td className="px-3 py-2">{String(row.id)}</td>
                <td className="px-3 py-2">{String(row.order_id)}</td>
                <td className="px-3 py-2">{String(row.rfc)}</td>
                <td className="px-3 py-2">{String(row.invoice_email)}</td>
                <td className="px-3 py-2">
                  <select className="bg-pilula-black" value={String(row.status)} onChange={(event) => updateStatus(String(row.id), event.target.value)}>
                    <option value="solicitada">solicitada</option>
                    <option value="en_revision">en revisión</option>
                    <option value="requiere_correccion">requiere corrección</option>
                    <option value="emitida">emitida</option>
                    <option value="enviada">enviada</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PricingConfigAdmin() {
  const supabase = useSupabase();
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState({
    rate: "",
    effectiveFrom: new Date().toISOString().slice(0, 16),
    effectiveUntil: "",
    status: "active"
  });

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/pricing", { headers: await authHeader(supabase) });
    if (response.ok) setRows(((await response.json()) as { rates: Row[] }).rates || []);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await fetch("/api/admin/pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader(supabase)) },
      body: JSON.stringify({
        ...form,
        effectiveFrom: new Date(form.effectiveFrom).toISOString(),
        effectiveUntil: form.effectiveUntil ? new Date(form.effectiveUntil).toISOString() : null
      })
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="grid gap-4 border border-pilula-gold/25 p-5 md:grid-cols-2">
        <input className="min-h-11 bg-pilula-black px-3" placeholder="USD_MXN_RATE" value={form.rate} onChange={(event) => setForm({ ...form, rate: event.target.value })} />
        <input className="min-h-11 bg-pilula-black px-3" type="datetime-local" value={form.effectiveFrom} onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })} />
        <input className="min-h-11 bg-pilula-black px-3" type="datetime-local" value={form.effectiveUntil} onChange={(event) => setForm({ ...form, effectiveUntil: event.target.value })} />
        <select className="min-h-11 bg-pilula-black px-3" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </select>
        <button className="min-h-11 bg-pilula-burgundy px-5 text-sm font-semibold text-white">Guardar tipo de cambio</button>
      </form>
      <DataTable rows={rows} />
    </div>
  );
}

function ExportButton({ endpoint, filename, label }: { endpoint: string; filename: string; label: string }) {
  const supabase = useSupabase();
  async function download() {
    const response = await fetch(endpoint, { headers: await authHeader(supabase) });
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <button className="inline-flex min-h-11 items-center border border-pilula-gold/30 px-4 text-sm" onClick={download}>
      Exportar {label} a CSV
    </button>
  );
}

function DataTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return <p className="text-sm text-pilula-ivory/65">Sin registros o sesión no autorizada.</p>;
  const headers = Object.keys(rows[0]).slice(0, 10);
  return (
    <div className="overflow-x-auto border border-pilula-gold/20">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-pilula-charcoal text-pilula-gold">
          <tr>{headers.map((header) => <th className="px-3 py-2" key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr className="border-t border-pilula-gold/10" key={String(row.id || index)}>
              {headers.map((header) => <td className="px-3 py-2 text-pilula-ivory/72" key={header}>{String(row[header] ?? "")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
