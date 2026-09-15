import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    "https://zyscvhfwiynsbusfinxf.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5c2N2aGZ3aXluc2J1c2ZpbnhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0NzMxMjYsImV4cCI6MjEwNTA0OTEyNn0.ojiEZOiQ0BQheKxIa5eIV1mUbqrEc-E1BnKeT2QCcs4",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Middleware will refresh auth cookies when Server Components cannot write them.
          }
        },
      },
    },
  );
}
