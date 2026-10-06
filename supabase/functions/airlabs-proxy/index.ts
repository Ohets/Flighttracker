const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: { message: "Method not allowed" } }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const apiKey = Deno.env.get("AIRLABS_API_KEY")?.trim();
  if (!apiKey) {
    return new Response(
      JSON.stringify({ ok: false, keyConfigured: false, error: { message: "AIRLABS_API_KEY is missing. Please set the Supabase Edge Function secret named AIRLABS_API_KEY." } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const requestUrl = new URL(req.url);
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (body && typeof body === "object") {
        for (const [key, value] of Object.entries(body)) {
          if (value !== undefined && value !== null && value !== "") requestUrl.searchParams.set(key, String(value));
        }
      }
    } catch (_) {
      // Empty or invalid JSON body: continue with query parameters.
    }
  }
  const allowed = ["/api/v9/flights", "/api/v9/flight", "/api/v9/airports"];
  const path = allowed.find((p) => requestUrl.pathname.endsWith(p));

  if (!path) {
    return new Response(
      JSON.stringify({ error: { message: "Not found" } }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const upstream = new URL("https://airlabs.co" + path);
  requestUrl.searchParams.forEach((value, key) => {
    if (key !== "api_key") upstream.searchParams.set(key, value);
  });
  upstream.searchParams.set("api_key", apiKey);

  try {
    const response = await fetch(upstream.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const body = await response.text();
    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", response.headers.get("Content-Type") || "application/json");
    headers.set("Cache-Control", path === "/api/v9/airports" ? "public, max-age=300" : "no-store");

    if (!response.ok) {\n      return new Response(JSON.stringify({ error: { message: `AirLabs HTTP ${response.status}`, upstream: body, keyConfigured: true } }), { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });\n    }\n\n    return new Response(body, { status: response.status, headers });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: {
          message: error instanceof Error ? error.message : "AirLabs request failed.",
        },
      }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
