-- Migrate payments table: switch default provider from mercadopago to wompi.
-- wompi_reference (uuid) continues as our internal idempotency reference sent
-- to Wompi as the payment reference. wompi_transaction_id now stores the actual
-- Wompi transaction ID received from the webhook (e.g. "42000-1723456789-12345").

alter table public.payments
  alter column provider set default 'wompi';

-- Index for fast webhook lookup by Wompi transaction ID.
create index if not exists payments_wompi_transaction_id_idx
  on public.payments (wompi_transaction_id)
  where wompi_transaction_id is not null;
