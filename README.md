# Bajada de Reyes - Familia Mallma

Aplicación React + Vite para registrar participantes, animalitos y asignaciones, con datos persistidos en Supabase.

## Configuración

1. En Supabase, abre **SQL Editor**, copia y ejecuta `supabase/schema.sql`. Si ya creaste las tablas, vuelve a ejecutarlo para agregar las columnas de año y cumplimiento de Cargos.
2. Copia `.env.example` a `.env.local` y configura la URL y la clave publicable del proyecto.
3. Ejecuta `npm install` y `npm run dev`.

La primera vez que se conecte a una base vacía, la aplicación migrará los registros existentes de `localStorage` a Supabase. Conserva los datos locales como respaldo.

## Seguridad

El esquema incluido permite acceso de lectura y escritura a los roles `anon` y `authenticated`, porque esta versión no implementa inicio de sesión. Cualquier persona que conozca la URL pública y la clave publicable puede acceder a los datos. No uses estas políticas para información privada; configura Supabase Auth y políticas RLS por usuario antes de publicar la app.
