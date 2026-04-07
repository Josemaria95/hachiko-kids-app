import { getPetReaction } from "../lib/pet-reactions";

describe("getPetReaction", () => {
  describe("reacciones básicas por dimensión", () => {
    it("instrucciones + helps → happy + nombre interpolado", () => {
      const r = getPetReaction("instrucciones", "helps", "Luna");
      expect(r.mood).toBe("happy");
      expect(r.message).toContain("Luna");
      expect(r.message).not.toContain("{name}");
    });

    it("instrucciones + refuses → neutral", () => {
      const r = getPetReaction("instrucciones", "refuses", "Mochi");
      expect(r.mood).toBe("neutral");
      expect(r.message).toContain("Mochi");
    });

    it("regulacion + explodes → sad", () => {
      const r = getPetReaction("regulacion", "explodes", "Luna");
      expect(r.mood).toBe("sad");
    });

    it("regulacion + regulates → happy", () => {
      const r = getPetReaction("regulacion", "regulates", "Luna");
      expect(r.mood).toBe("happy");
    });

    it("animo + low → sad", () => {
      const r = getPetReaction("animo", "low", "Luna");
      expect(r.mood).toBe("sad");
    });

    it("prosocial + shares → happy", () => {
      const r = getPetReaction("prosocial", "shares", "Luna");
      expect(r.mood).toBe("happy");
    });
  });

  describe("override por emoción negativa del niño", () => {
    it("emoción sad anula reacción happy → mascota valida tristeza", () => {
      const r = getPetReaction("instrucciones", "helps", "Luna", "sad");
      expect(r.mood).toBe("sad");
      expect(r.message).toContain("Luna");
    });

    it("emoción angry anula reacción neutral → mascota valida enojo", () => {
      const r = getPetReaction("socializacion", "alone", "Mochi", "angry");
      expect(r.mood).toBe("angry");
    });

    it("emoción scared anula reacción happy → mascota valida miedo", () => {
      const r = getPetReaction("prosocial", "compromises", "Luna", "scared");
      expect(r.mood).toBe("scared");
    });

    it("emoción happy NO anula reacción (no es negativa)", () => {
      const r = getPetReaction("instrucciones", "helps", "Luna", "happy");
      expect(r.mood).toBe("happy");
    });

    it("emoción neutral NO anula reacción", () => {
      const r = getPetReaction("animo", "low", "Luna", "neutral");
      expect(r.mood).toBe("sad"); // animo+low sigue siendo sad
    });
  });

  describe("no anula cuando la reacción ya coincide con la emoción", () => {
    it("regulacion + explodes con emoción sad → no sobreescribe (explodes ya es sad)", () => {
      const r = getPetReaction("regulacion", "explodes", "Luna", "sad");
      // explodes → mood sad, y emoción sad, pero el override solo aplica
      // cuando reaction.mood !== emotion → aquí sí coinciden → no override
      expect(r.mood).toBe("sad");
      // El mensaje debe ser el de regulacion/explodes, no el override de sad
      expect(r.message).toContain("emociones son grandes");
    });
  });

  describe("choice desconocido → fallback neutral", () => {
    it("choice inexistente devuelve neutral con nombre del pet", () => {
      const r = getPetReaction("instrucciones", "unknown_value", "Luna");
      expect(r.mood).toBe("neutral");
      expect(r.message).toContain("Luna");
    });
  });

  describe("interpolación de nombre", () => {
    it("nunca deja {name} sin reemplazar", () => {
      const dimensions = ["instrucciones", "socializacion", "prosocial", "regulacion", "animo"] as const;
      const choices = ["helps", "refuses", "delays", "social", "alone", "one_friend", "shares", "keeps", "compromises", "regulates", "explodes", "withdraws", "great", "okay", "low"];
      for (const dim of dimensions) {
        for (const choice of choices) {
          const r = getPetReaction(dim, choice, "TestPet");
          expect(r.message).not.toContain("{name}");
        }
      }
    });
  });
});
