import { afterEach } from "vitest";

// La suite no usa `globals: true`, así que el auto-cleanup de testing-library no
// se engancha solo: sin esto, cada render se apila en el mismo document y las
// queries empiezan a encontrar elementos duplicados del test anterior.
// Import dinámico porque los tests de node corren con este mismo setup y no
// tienen DOM: fuera de jsdom, testing-library/react explota al importarse.
afterEach(async () => {
  if (typeof document === "undefined") return;
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});
