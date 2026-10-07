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
    return new Response(JSON.stringify({ error: { message: "Method not allowed" } }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("AIRLABS_API_KEY")?.trim();

  if (!apiKey) {
    return new Response(JSON.stringify({
      ok: false,
      keyConfigured: false,
      error: { message: "AIRLABS_API_KEY is missing in Supabase." },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const params: Record<string, string> = {};

  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (body && typeof body === "object") {
        for (const [key, value] of Object.entries(body)) {
          if (value !== undefined && value !== null && value !== "") {
            params[key] = String(value);
          }
        }
      }
    } catch (_) {}
  }

  const requestUrl = new URL(req.url);
  requestUrl.searchParams.forEach((value, key) => {
    if (key !== "api_key") params[key] = value;
  });

  const endpoints: Record<string, string> = {
    flights: "/api/v9/flights",
    flight: "/api/v9/flight",
    airports: "/api/v9/airports",
  };

  const endpointName = params.endpoint || "flights";
  const path = endpoints[endpointName];

  if (!path) {
    return new Response(JSON.stringify({
      error: {
        message: "Invalid endpoint",
        allowed: ["flights", "flight", "airports"],
      },
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  delete params.endpoint;

  const upstream = new URL("https://airlabs.co" + path);

  for (const [key, value] of Object.entries(params)) {
    upstream.searchParams.set(key, value);
  }

  upstream.searchParams.set("api_key", apiKey);

  try {
    const response = await fetch(upstream.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const body = await response.text();

    if (!response.ok) {
      return new Response(JSON.stringify({
        error: {
          message: `AirLabs HTTP ${response.status}`,
          upstream: body,
          keyConfigured: true,
        },
      }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(body, {
      status: response.status,
      headers: {
        ...corsHeaders,
        "Content-Type": response.headers.get("Content-Type") || "application/json",
        "Cache-Control": endpointName === "airports" ? "public, max-age=300" : "no-store",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: {
        message: error instanceof Error ? error.message : "AirLabs request failed.",
      },
    }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
