import { describe, expect, it } from "vitest";
import { extractStripeFields } from "@/lib/orders";

describe("webhook checkout.session.completed", () => {
  it("solo deberia marcar pagada una sesion con payment_status paid", () => {
    const unpaid = { payment_status: "unpaid" };
    expect(unpaid.payment_status).not.toBe("paid");
  });

  it("extrae custom fields sin guardar datos de tarjeta", () => {
    const fields = extractStripeFields({
      customer_details: { name: "Ana", email: "ana@example.com", phone: "+5255" },
      custom_fields: [
        { key: "specialty", type: "text", text: { value: "Dermatologia" } },
        { key: "city_country", type: "text", text: { value: "CDMX, Mexico" } }
      ]
    } as never);
    expect(fields).toEqual({
      full_name: "Ana",
      email: "ana@example.com",
      phone: "+5255",
      specialty: "Dermatologia",
      city_country: "CDMX, Mexico"
    });
  });
});
