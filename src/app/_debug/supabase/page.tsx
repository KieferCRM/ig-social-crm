"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function SupabaseDebugPage() {
  const [message, setMessage] = useState("Testing connection...");

  useEffect(() => {
    const testConnection = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setMessage("❌ Error: " + error.message);
      } else {
        setMessage("✅ Connected to Supabase successfully");
      }
    };

    testConnection();
  }, []);

  return (
    <main style={{ padding: "40px", fontFamily: "Arial" }}>
      <h1>Supabase Debug Page</h1>
      <p>{message}</p>
    </main>
  );
}