import Stripe from "npm:stripe@^22";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const priceId = Deno.env.get("STRIPE_PRICE_ID")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const siteUrl = "https://GuptaAishani.github.io/Specly";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Please sign in first." }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: existing } = await admin
      .from("subscriptions")
      .select("stripe_customer_id,status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing && ["trialing", "active"].includes(existing.status)) {
      return json({ error: "This account already has an active membership." }, 409);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      ...(existing?.stripe_customer_id
        ? { customer: existing.stripe_customer_id }
        : { customer_email: user.email || undefined }),
      subscription_data: {
        ...(existing ? {} : { trial_period_days: 3 }),
        metadata: { supabase_user_id: user.id },
      },
      metadata: { supabase_user_id: user.id },
      success_url: `${siteUrl}/commerce.html?checkout=success`,
      cancel_url: `${siteUrl}/commerce.html?checkout=cancelled`,
      allow_promotion_codes: false,
    });

    return json({ url: session.url });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Checkout failed." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
