# PILULA Checkout

Checkout privado para PÍLULA MedPlanner y la 7ª edición del Hair Transplant Workshop by GeVa. La página pública no crea sesiones de pago; únicamente muestra solicitud de lugar para médicos y solicitud de valoración para pacientes. Todo pago nace desde una invitación aprobada en servidor y puede operar tarjeta USD, tarjeta MXN o SPEI MXN.

## Arquitectura

- Next.js App Router, TypeScript estricto y Tailwind CSS.
- Stripe Checkout alojado por Stripe; PÍLULA no recibe números completos de tarjeta.
- Supabase para órdenes, invitaciones, eventos, solicitudes de CFDI y Supabase Auth del admin.
- Service role solo en rutas de servidor.
- Resend para invitaciones, confirmaciones y notificaciones.
- RLS activo y sin acceso público directo a tablas.
- `LEGAL_APPROVED` bloquea lanzamiento live si falta aprobación.

## Instalación

```bash
npm install
cp .env.example .env.local
npm run dev
```

Comandos de validación:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Problemas de estilos en desarrollo

Si la aplicación carga HTML sin estilos, enlaces azules o fondo blanco:

1. Detener el servidor.
2. Eliminar la caché de Next:

   ```bash
   rm -rf .next
   ```

3. Reiniciar:

   ```bash
   npm run dev
   ```

4. Verificar en Network que:

   ```text
   /_next/static/css/app/layout.css
   ```

   responda:

   ```text
   Status: 200
   Content-Type: text/css
   ```

El proyecto utiliza Tailwind CSS v3. No migrar a Tailwind v4 sin actualizar de forma coordinada PostCSS, `globals.css` y la configuración de Tailwind.

## Variables pendientes

Configurar en `.env.local` y Vercel:

- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_DOCTOR`
- `STRIPE_PRICE_PATIENT`
- `STRIPE_TAX_RATE_IVA_16`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ADMIN_ALLOWED_EMAIL` lista de correos separados por comas, por ejemplo `pilulamedplanner@gmail.com,trinopc1@gmail.com`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `INVOICE_LINK_SECRET`
- `PAYMENT_INVITE_OTP_SECRET`
- `ACCOUNTING_NOTIFICATION_EMAIL` opcional; si está vacío se notifica a `YOANNA_NOTIFICATION_EMAIL`

## Precios definitivos

PÍLULA absorbe la comisión de Stripe. No se agrega processing fee, service fee, convenience fee ni recargo.

- Doctor: subtotal `USD 6,000.00`, IVA `USD 960.00`, total `USD 6,960.00`.
- Paciente: subtotal `USD 800.00`, IVA `USD 128.00`, total `USD 928.00`.

Para MXN, la invitación congela el tipo de cambio PÍLULA:

```text
base_amount_mxn = base_amount_usd × exchange_rate
tax_amount_mxn = base_amount_mxn × 0.16
total_amount_mxn = base_amount_mxn + tax_amount_mxn
```

Los importes finales se guardan como enteros en centavos y no se recalculan si cambia la tasa activa.

## Invitaciones de pago

Tabla: `payment_invites`.

Cada invitación almacena `profile_type`, `market`, `payment_currency`, `allowed_payment_methods`, `exchange_rate_mxn_per_usd`, `exchange_rate_source`, `exchange_rate_locked_at`, subtotal, IVA, total y moneda. `/api/checkout` usa exclusivamente esos valores de servidor.

Crear invitación por CLI:

```bash
npm run invite:payment -- --profile doctor --market mexico --currency mxn --methods card_and_bank_transfer --rate 18.50 --email medico@example.com --name "Nombre" --whatsapp 525532019586
npm run invite:payment -- --profile patient --market international --currency usd --methods card --email paciente@example.com --name "Nombre"
```

La URL privada usa `/pagar/[token]`. El token no se guarda en texto plano; solo se almacena `token_hash`.

## Configuración de tipo de cambio

Ruta admin:

```text
/admin/configuracion/precios
```

Guarda `USD_MXN_RATE` en `exchange_rates` con `rate`, `effective_from`, `effective_until`, `created_by`, `created_at` y `status`.

## Checkout

Antes de crear Stripe Checkout se exige:

- Aceptar términos y política de cancelación.
- Confirmar expresamente total y moneda.

La orden guarda `terms_version`, `terms_hash`, `terms_accepted_at`, `cancellation_policy_version`, `payment_invite_id`, `amount_total`, `currency`, `payment_method`, `amount_received`, `amount_remaining`, tipo de cambio usado y `user_agent`.

Rutas de pago soportadas:

- Tarjeta internacional en USD.
- Tarjeta mexicana en MXN.
- SPEI en MXN mediante Stripe Bank Transfers / Customer Balance.

SPEI usa `payment_method_types=["customer_balance"]` y `mx_bank_transfer`. El flujo es asíncrono: la orden no queda pagada ni consume invitación hasta recibir fondos completos vía Stripe.

## Panel admin

Rutas:

- `/admin/login`
- `/admin`
- `/admin/invitaciones`
- `/admin/pagos`
- `/admin/facturas`

Autenticación: Supabase Auth magic link. Allowlist inicial: `pilulamedplanner@gmail.com`.

El panel permite crear, aprobar, reenviar, revocar y ver invitaciones; abrir WhatsApp con mensaje prellenado; enviar email con Resend; ver pagos; filtrar por USD, MXN, tarjeta, SPEI, pendiente, parcialmente pagado, pagado, vencido o revisión manual; ver solicitudes de factura; cambiar estados manuales de CFDI; exportar pagos y facturas a CSV.

## Stripe

Crear productos y Prices one-time:

- `HTW 2026 · Médico participante`, Price `USD 6000`, `tax_behavior=exclusive`.
- `HTW 2026 · Paciente seleccionado`, Price `USD 800`, `tax_behavior=exclusive`.

Crear Tax Rate:

- `IVA México 16%`, `16`, `inclusive=false`.

Webhook:

```text
https://checkout.pilula.com.mx/api/stripe/webhook
```

Eventos:

- `checkout.session.completed`
- `checkout.session.expired`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `payment_intent.payment_failed`
- `payment_intent.succeeded`
- `customer_cash_balance_transaction.created`
- `charge.refunded`
- `charge.dispute.created`

## Supabase

Ejecutar `supabase/migrations/001_checkout_schema.sql`. Crea:

- `pilula_orders`
- `payment_invites`
- `stripe_events`
- `invoice_requests`
- `exchange_rates`

Todas las tablas tienen RLS activo y políticas de no acceso público.

## Facturación manual

No hay PAC integrado. El contador emitirá cada CFDI manualmente. Nuevas solicitudes notifican a `ACCOUNTING_NOTIFICATION_EMAIL`; si está vacío, solo a Yoanna.

Estados manuales:

- `solicitada`
- `en_revision`
- `requiere_correccion`
- `emitida`
- `enviada`

## Datos legales de proveedor

- Razón social: `PILULA`
- RFC: `PIL2603204H1`
- Régimen de capital: `Sociedad por Acciones Simplificada`
- Régimen fiscal: `Régimen Simplificado de Confianza`
- Domicilio: `Calle Atenas 40, Interior 602, Colonia Juárez, Cuauhtémoc, Ciudad de México, C.P. 06600, México.`
- Nombre comercial: `PÍLULA MedPlanner`

No guardar ni mostrar datos bancarios.

## SPEI

La app no muestra cuentas bancarias internas de PÍLULA. Las instrucciones y referencia provienen de Stripe. Si el pago recibido es menor al total, la orden queda `partially_funded` y muestra saldo pendiente. Si llega después del vencimiento, la orden queda `requires_manual_review` y se notifica a Yoanna.

## Dominios

- `checkout.pilula.com.mx`: Vercel.
- `pay.pilula.com.mx`: Stripe Checkout custom domain.

No asignar `checkout.pilula.com.mx` simultáneamente a Stripe y Vercel.

## Checklist live

1. Colocar assets oficiales en `public/brand`.
2. Ejecutar migración Supabase.
3. Configurar Supabase Auth magic link y URL de redirección `/admin`.
4. Configurar Stripe products, Prices, Tax Rate y webhook.
5. Configurar Resend y dominio de correo.
6. Configurar variables en Vercel.
7. Probar invitación doctor en test mode.
8. Probar invitación paciente en test mode.
9. Probar webhook, correo, success page y factura.
10. Confirmar `LEGAL_APPROVED=true`.
11. Apuntar `checkout.pilula.com.mx` a Vercel.
12. Verificar `pay.pilula.com.mx` en Stripe.
