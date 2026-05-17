-- Guarantees deterministic upsert(payment_id) for refund records.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'refunds_payment_id_unique'
  ) then
    alter table public.refunds
      add constraint refunds_payment_id_unique unique (payment_id);
  end if;
end $$;
