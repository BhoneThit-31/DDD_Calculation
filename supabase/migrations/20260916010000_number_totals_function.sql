create or replace function public.get_number_totals(
  p_dealer_id uuid,
  p_commission_id uuid,
  p_draw_period_id uuid
)
returns table(number text, total_amount numeric)
language sql
stable
as $$
  select si.number, sum(si.amount)::numeric as total_amount
  from public.sales_items si
  join public.sales_entries se on se.id = si.sales_entry_id
  where se.dealer_id = p_dealer_id
    and se.commission_id = p_commission_id
    and se.draw_period_id = p_draw_period_id
    and se.status = 'active'
  group by si.number
$$;
