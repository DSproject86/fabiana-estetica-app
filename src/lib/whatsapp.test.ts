import { describe, expect, it } from "vitest";
import { whatsappChatLink, whatsappShareLink } from "./whatsapp";

describe("link WhatsApp", () => {
  it("toglie + e spazi dal numero e codifica il testo", () => {
    expect(whatsappChatLink("+39 333 123 4567", "Ciao Fabiana, sono Anna & co.")).toBe(
      "https://wa.me/393331234567?text=Ciao%20Fabiana%2C%20sono%20Anna%20%26%20co.",
    );
    expect(whatsappChatLink("+393331234567")).toBe("https://wa.me/393331234567");
  });

  it("condivisione senza destinatario", () => {
    expect(whatsappShareLink("Iscriviti: https://x.it/invito/abc?x=1")).toBe(
      "https://wa.me/?text=Iscriviti%3A%20https%3A%2F%2Fx.it%2Finvito%2Fabc%3Fx%3D1",
    );
  });
});
