import { getScenarioForToday, getDimensionLabel } from "../lib/scenarios";

describe("getScenarioForToday", () => {
  it("devuelve un scenario válido con id, dimension, situation y choices", () => {
    const s = getScenarioForToday("child-abc-123");
    expect(s).toHaveProperty("id");
    expect(s).toHaveProperty("dimension");
    expect(s).toHaveProperty("situation");
    expect(Array.isArray(s.choices)).toBe(true);
    expect(s.choices.length).toBeGreaterThanOrEqual(2);
  });

  it("cada choice tiene label y value", () => {
    const s = getScenarioForToday("child-abc-123");
    for (const choice of s.choices) {
      expect(typeof choice.label).toBe("string");
      expect(typeof choice.value).toBe("string");
      expect(choice.label.length).toBeGreaterThan(0);
      expect(choice.value.length).toBeGreaterThan(0);
    }
  });

  it("es determinista: mismo childId mismo día → mismo scenario", () => {
    const a = getScenarioForToday("same-child-id");
    const b = getScenarioForToday("same-child-id");
    expect(a.id).toBe(b.id);
  });

  it("distinto childId mismo día → puede dar distinto scenario", () => {
    // Con 30 scenarios, es prácticamente imposible que dos IDs distintos den el mismo
    const ids = Array.from({ length: 10 }, (_, i) => `child-${i}`);
    const scenarioIds = ids.map((id) => getScenarioForToday(id).id);
    const unique = new Set(scenarioIds);
    // Al menos 2 escenarios distintos entre 10 niños distintos
    expect(unique.size).toBeGreaterThan(1);
  });

  it("la dimension del scenario es una de las 5 válidas", () => {
    const validDimensions = ["instrucciones", "socializacion", "prosocial", "regulacion", "animo"];
    const s = getScenarioForToday("test-child");
    expect(validDimensions).toContain(s.dimension);
  });
});

describe("getDimensionLabel", () => {
  it("devuelve label legible para cada dimensión", () => {
    expect(getDimensionLabel("instrucciones")).toBe("Seguimiento de instrucciones");
    expect(getDimensionLabel("socializacion")).toBe("Socialización");
    expect(getDimensionLabel("prosocial")).toBe("Conducta prosocial");
    expect(getDimensionLabel("regulacion")).toBe("Regulación emocional");
    expect(getDimensionLabel("animo")).toBe("Ánimo general");
  });
});
