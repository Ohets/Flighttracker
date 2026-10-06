export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    if (request.method === "OPTIONS") return new Response(null, {status:204, headers:cors});
    if (request.method !== "GET") return new Response("Method not allowed", {status:405, headers:cors});

    const url = new URL(request.url);
    const allowed = ["/api/v9/flights", "/api/v9/flight", "/api/v9/airports"];
    if (!allowed.includes(url.pathname)) return new Response("Not found", {status:404, headers:cors});
    if (!env.AIRLABS_API_KEY) {
      return new Response(JSON.stringify({error:{message:"AIRLABS_API_KEY is not configured on the Worker."}}), {
        status:500, headers:{...cors,"Content-Type":"application/json"}
      });
    }

    const upstream = new URL("https://airlabs.co" + url.pathname);
    url.searchParams.forEach((value,key)=>{ if(key !== "api_key") upstream.searchParams.set(key,value); });
    upstream.searchParams.set("api_key", env.AIRLABS_API_KEY);

    const response = await fetch(upstream.toString(), {headers:{"Accept":"application/json"}});
    const body = await response.text();
    const headers = new Headers(cors);
    headers.set("Content-Type", response.headers.get("Content-Type") || "application/json");
    headers.set("Cache-Control", url.pathname === "/api/v9/airports" ? "public, max-age=300" : "no-store");
    return new Response(body, {status:response.status, headers});
  }
};
