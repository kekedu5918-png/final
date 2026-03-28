import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@14?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeSecret) {
    console.error("STRIPE_SECRET_KEY manquant");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripe = new Stripe(stripeSecret, {
    apiVersion: "2024-11-20",
    httpClient: Stripe.createFetchHttpClient(),
  });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { userId?: string; email?: string; plan?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { userId, email, plan } = body;

  if (!userId || userId !== user.id) {
    return new Response(JSON.stringify({ error: "userId mismatch" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const planKey = plan === "6m" ? "6m" : plan === "2m" ? "2m" : null;
  if (!planKey) {
    return new Response(JSON.stringify({ error: "Invalid plan" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const price =
    planKey === "6m"
      ? { amount: 14900, label: "OPJ Elite PRO — 6 mois (149€)" }
      : { amount: 5900, label: "OPJ Elite PRO — 2 mois (59€)" };

  const successUrl =
    "https://kekedu5918-png.github.io/OPJFIN/?payment=success";
  const cancelUrl =
    "https://kekedu5918-png.github.io/OPJFIN/?payment=cancel";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email || user.email || undefined,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: price.label,
            },
            unit_amount: price.amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        user_id: user.id,
        plan: planKey,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    const checkoutUrl = session.url;
    if (!checkoutUrl) {
      return new Response(JSON.stringify({ error: "No checkout URL" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ url: checkoutUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Stripe error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
