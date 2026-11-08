-- Ejecutar en la base existente con participants, animals y charges.
-- Los UUID de participantes y animalitos referenciados deben existir.
begin;
alter table public.charges
  add column if not exists event_year integer;
update public.charges set event_year = 2026 where event_year is null;
alter table public.charges alter column event_year set default 2027;
alter table public.charges alter column event_year set not null;
alter table public.charges
  add column if not exists fulfillment_status text not null default 'En espera';
alter table public.charges
  drop constraint if exists charges_fulfillment_status_check;
alter table public.charges
  add constraint charges_fulfillment_status_check
  check (fulfillment_status in ('Cumplió', 'En espera', 'No cumplió'));


create table if not exists public.historial (
  id uuid primary key,
  participant_id uuid references public.participants(id) on delete set null,
  participant_name text not null,
  animal_id uuid references public.animals(id) on delete set null,
  cargo text not null,
  detail text not null default '',
  event_year integer not null default 2026,
  fulfillment_status text not null default 'En espera' check (fulfillment_status in ('Cumplió', 'En espera', 'No cumplió')),
  created_at timestamptz not null default now()
);


alter table public.historial enable row level security;
grant select, insert, update, delete on public.historial to anon, authenticated;
drop policy if exists "Public can manage historial" on public.historial;
create policy "Public can manage historial"
  on public.historial for all to anon, authenticated
  using (true) with check (true);

insert into public.historial (
  id, participant_id, participant_name, animal_id, cargo, detail, event_year, fulfillment_status
) values
  ('20260000-0000-4000-8000-000000000001', 'adec3b77-7220-413e-a76e-88d4e0b82ec9', 'Tio Jose', '345ab754-a462-4b76-a0c0-d078f8fb542c', 'Maria y Jose', 'PREPARAR CENA', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000002', '35883aff-bc0c-4460-a449-2726c77c2dd6', 'Beatriz', '9eaf7af1-3bf9-4bf2-bcea-56ba6dcb5794', 'Vaca chica gelat', '40 GELATINAS', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000003', '01471797-f5aa-4055-8e69-965f566d43ea', 'Valeria', '510cd664-ef89-4d29-a603-97ed026e7a3b', 'Pollo c/brillo', '1 CERVEZA', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000004', 'da203292-df63-459b-ae2e-ef8b3f39f422', 'Raquel', 'efa062bc-0807-464e-a410-823afc8c2a86', 'Burro clasico gris', '40 petipanes', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000005', 'd5796150-a504-46cd-a722-d1dcab08048e', 'Cesar', '9fea0eb6-f55a-48b0-8f7c-30e15ba08bb5', 'Vaca con cantaros', 'ARMAR NACIMIENTO Y ARBOL', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000006', '6b8e21b3-7af2-436d-a6fd-208c1f1e1249', 'America', 'bd499b00-b56f-44cc-b502-2574bae9db7a', 'Oveja c/lana gaseosa', '1 GASEOSA 3LT', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000007', '809d6225-370d-4700-8445-0f6d30a45957', 'Tio marco', '6385baf1-133a-4547-ad77-cd45485ad389', 'Camello chico', '1 CERVEZA', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000008', '35883aff-bc0c-4460-a449-2726c77c2dd6', 'Beatriz', 'b5b5f4cd-93f5-449e-8665-241392e84b20', 'Camello 4 Cervecero', '4 CERVEZAS', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000009', '01471797-f5aa-4055-8e69-965f566d43ea', 'Valeria', '7624eea9-6670-4c1f-8990-585bb0eaf2c1', 'Pastora', 'BOCADITOS', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000010', '35883aff-bc0c-4460-a449-2726c77c2dd6', 'Beatriz', 'bd74d516-db3f-4f59-b810-628e537d27d2', 'Oveja c/lana cerveza 1', '1 CERVEZA NEGRA', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000011', '809d6225-370d-4700-8445-0f6d30a45957', 'Tio marco', '81ebd6de-641e-4f1a-adcd-6a46b512da08', 'Burro Cervecero(2)', '2 CERVEZAS', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000012', 'd5796150-a504-46cd-a722-d1dcab08048e', 'Cesar', '8ad8a8cb-589f-4e55-8af3-aef19211f284', 'Burro Mediano plateado', '1 CAJA CERVEZA', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000013', '64674c83-ee4c-4a51-b73a-bd53cd3c3529', 'Emanuel', '2740c46e-9103-40e4-bc1e-beda6d83cc3e', 'Pato c/brillo', '1 CERVEZA', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000014', '6d7424a8-86e0-47af-8abc-3d7426237f3d', 'David', 'c2201c0e-ae71-445d-b997-c4e5b72d5019', 'Burro Chico', 'BALDE DE CHICHA', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000015', '01471797-f5aa-4055-8e69-965f566d43ea', 'Valeria', 'c6382bef-f052-4be5-b59f-93cb853970be', 'Oveja c/lana cerveza 2', '1 CERVEZA NEGRA', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000016', 'd5656ace-c6ec-4b46-be8e-01bcd3c6f509', 'Lupe', 'd73db517-9ffb-427c-9706-ee53db03f32a', 'Camello 1 M', 'PIÑATA', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000017', '18c11f78-3cc3-466e-8550-a27b2f9c23bb', 'Jessica', 'a10f6f7b-a5df-46e1-8178-04027aba59c1', 'Camello 2 G', 'RELLENO SURTIDO', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000018', 'e82d32d8-c4e6-4afe-bb75-7fcfe2d3f13d', 'Gabriela', '7583bc07-a117-428b-9e0f-8840c236b6ac', 'Camello 3 B', 'RELLENO CARAMELOS', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000019', 'd5796150-a504-46cd-a722-d1dcab08048e', 'Cesar', '5eab13cf-9718-41a5-93cc-9d05aa278f9c', 'Angel Grande', '2 GASEOSAS 3LT', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000020', 'a308a5f4-0726-438c-9766-2f6b134dbe2c', 'Leticia', 'b5b5f4cd-93f5-449e-8665-241392e84b20', 'Camello 4 Cervecero', '4 CERVEZAS', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000021', 'b1bd2c94-b4c0-4db9-9cc9-c88e1e24d5f4', 'Erick', 'cfad0694-fcd5-4087-a540-9fc0d678bca9', 'Ninio Jesus', 'LLEVAR A LA MISA; Cambiar ropa', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000022', '64674c83-ee4c-4a51-b73a-bd53cd3c3529', 'Emanuel', 'c6382bef-f052-4be5-b59f-93cb853970be', 'Oveja c/lana cerveza 2', '1 CERVEZA NEGRA', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000023', 'a74ed3ba-cc52-4c87-acd9-a8b045d1a3f3', 'Tio koki', '154b3fe2-ac76-427f-ae2c-43a544429ee9', 'Camello 6 Cervecero', '4 CERVEZAS', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000024', '35883aff-bc0c-4460-a449-2726c77c2dd6', 'Beatriz', 'f9ac2ad9-c91b-4c0a-82b5-f18d31256556', 'Burro Grande Plateado', 'MEDIA CAJA DE CERVEZA', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000025', '64674c83-ee4c-4a51-b73a-bd53cd3c3529', 'Emanuel', '1f5d03e2-021a-4fe4-af23-4574919c9f04', 'Vaca Grande', 'BOCADITOS', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000026', 'd08afe77-a4f0-4aa6-9054-336a74b0ae5b', 'Cielo', 'ef07589c-d349-4255-8ce2-7af967e538fe', 'Pastor Grande', '4 CERVEZAS', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000027', '64674c83-ee4c-4a51-b73a-bd53cd3c3529', 'Emanuel', 'd1834682-9bb2-437d-afe1-b43ac5d07887', 'Melchor', '1 CAJA DE CERVEZA NEGRA', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000028', '809d6225-370d-4700-8445-0f6d30a45957', 'Tio marco', '8053367a-0898-4f85-add2-af225d22191f', 'Vaca Plateada', 'MEDIA CAJA DE CERVEZA', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000029', 'e82d32d8-c4e6-4afe-bb75-7fcfe2d3f13d', 'Gabriela', '5eab13cf-9718-41a5-93cc-9d05aa278f9c', 'Big Angel', '1/2 CAJA', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000030', 'b1bd2c94-b4c0-4db9-9cc9-c88e1e24d5f4', 'Erick', '31d4dac6-5d70-4787-a126-4671f594d074', 'Gaspar', '8 CERVEZAS', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000031', '94fba339-f0c9-4be3-9b74-6d10245394bc', 'Leandro', '66393c75-898c-46de-b74d-3b345600c2df', 'Baltazar', 'MEDIA CAJA DE CERVEZA', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000032', 'd5656ace-c6ec-4b46-be8e-01bcd3c6f509', 'Lupe', null, 'Voluntario', 'SORPRESA', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000033', '6d7424a8-86e0-47af-8abc-3d7426237f3d', 'David', 'c2201c0e-ae71-445d-b997-c4e5b72d5019', 'Voluntario', 'BURRO CHICO — RENOVAR ANIMAL', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000034', 'b1bd2c94-b4c0-4db9-9cc9-c88e1e24d5f4', 'Erick', 'bb8d21dc-d742-48ba-bc82-9ce77635a3a8', 'Voluntario', 'MUÑECO DE NIEVE NUEVO — NUEVA ESTATUA', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000035', 'b1bd2c94-b4c0-4db9-9cc9-c88e1e24d5f4', 'Erick', '66393c75-898c-46de-b74d-3b345600c2df', 'Voluntario', 'BALTAZAR — RENOVAR', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000036', 'e82d32d8-c4e6-4afe-bb75-7fcfe2d3f13d', 'Gabriela', null, 'Voluntario', 'PAVO CHICO — RENOVAR ANIMAL', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000037', 'a308a5f4-0726-438c-9766-2f6b134dbe2c', 'Leticia', 'a99337f3-0477-4dad-9b28-0528cb29d43e', 'Voluntario', 'VACA CHIQUITA — RENOVAR ANIMAL', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000038', 'a308a5f4-0726-438c-9766-2f6b134dbe2c', 'Leticia', '85907db8-acba-4c1b-aea2-f24e8c9c9060', 'Voluntario', '2 ANGEL GRANDE NUEVO — NUEVO', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000039', '0c14a510-2c88-4946-9fb9-e12752830150', 'Tio luis', '6e812c43-b6db-47a4-8cd4-f8aec5b205b2', 'Voluntario', 'RENO RODOLFO — NUEVO ANIMAL', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000040', '809d6225-370d-4700-8445-0f6d30a45957', 'Tio marco', null, 'Voluntario', 'GALLO MEDIANO — NUEVO ANIMAL', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000041', '809d6225-370d-4700-8445-0f6d30a45957', 'Tio marco', 'd2a39d09-be76-40f6-aa10-3412c92d82ff', 'Voluntario', 'PAPA NOEL NUEVO — NUEVA ESTATUA', 2026, 'En espera'),
  ('20260000-0000-4000-8000-000000000042', '6b8e21b3-7af2-436d-a6fd-208c1f1e1249', 'America', null, 'Voluntario', 'DISFRAZ DE HUAILEJIA — VESTIRSE', 2026, 'En espera')
on conflict (id) do nothing;

commit;
select event_year, count(*) as total from public.historial group by event_year order by event_year;
