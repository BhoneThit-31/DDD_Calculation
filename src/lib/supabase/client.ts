import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    "https://zyscvhfwiynsbusfinxf.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5c2N2aGZ3aXluc2J1c2ZpbnhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0NzMxMjYsImV4cCI6MjEwNTA0OTEyNn0.ojiEZOiQ0BQheKxIa5eIV1mUbqrEc-E1BnKeT2QCcs4",
  );
}
