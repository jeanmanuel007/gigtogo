alter table public.shift_applications
drop constraint if exists shift_applications_status_check;

alter table public.shift_applications
add constraint shift_applications_status_check
check (status in ('pending', 'accepted', 'rejected', 'cancelled'));

drop policy if exists "workers can cancel their applications" on public.shift_applications;

create policy "workers can cancel their applications"
on public.shift_applications for update
to authenticated
using (auth.uid() = worker_id)
with check (auth.uid() = worker_id and status in ('pending', 'cancelled'));

drop policy if exists "assigned workers can release their shifts" on public.shifts;

create policy "assigned workers can release their shifts"
on public.shifts for update
to authenticated
using (auth.uid() = accepted_worker_id)
with check (accepted_worker_id is null);
