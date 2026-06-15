import Stripe from "stripe"

let _stripe: Stripe | undefined

export const stripe = new Proxy({} as Stripe, {
  get(_, prop: string | symbol) {
    if (!_stripe) {
      _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: "2026-04-22.dahlia",
      })
    }
    const val = (_stripe as any)[prop]
    return typeof val === "function" ? val.bind(_stripe) : val
  },
})

/** Get or create a Stripe customer for the given user email */
export async function getOrCreateCustomer(
  email: string,
  name: string | null | undefined,
  existingCustomerId: string | null | undefined,
): Promise<string> {
  if (existingCustomerId) return existingCustomerId

  const customer = await stripe.customers.create({
    email,
    name: name ?? undefined,
    metadata: { offduty: "true" },
  })
  return customer.id
}
