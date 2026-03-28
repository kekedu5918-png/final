import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@14?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cryptoProvider = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!stripeSecret || !webhookSecret) {
    console.error("STRIPE_SECRET_KEY ou STRIPE_WEBHOOK_SECRET manquant");
    return new Response("Server misconfigured", { status: 500 });
  }

  const stripe = new Stripe(stripeSecret, {
    apiVersion: "2024-11-20",
    httpClient: Stripe.createFetchHttpClient(),
  });

  const signature = req.headers.get("Stripe-Signature");
  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    console.error("Webhook signature:", err);
    const msg = err instanceof Error ? err.message : "Invalid signature";
    return new Response(`Webhook Error: ${msg}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;
    const plan = session.metadata?.plan === "6m" ? "6m" : "2m";

    if (!userId) {
      console.error("checkout.session.completed sans metadata.user_id");
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const months = plan === "6m" ? 6 : 2;
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + months);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const customerRaw = session.customer;
    const stripeCustomerId =
      typeof customerRaw === "string"
        ? customerRaw
        : customerRaw &&
            typeof customerRaw === "object" &&
            "id" in customerRaw
          ? (customerRaw as { id: string }).id
          : null;

    const row = {
      user_id: userId,
      is_pro: true,
      expires_at: expiresAt.toISOString(),
      stripe_customer_id: stripeCustomerId,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("subscriptions").upsert(row, {
      onConflict: "user_id",
    });

    if (error) {
      console.error("subscriptions upsert:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
