import { describe, expect, it } from "vitest";
import { rutCheckDigit, rutEquals, rutIsValid, rutNormalize } from "../../src/functions/huemul-rut";

describe("rutNormalize", () => {
  it("lleva cualquier formato a 12345678-K", () => {
    expect(rutNormalize("76.123.456-k")).toBe("76123456-K");
    expect(rutNormalize("76123456K")).toBe("76123456-K");
    expect(rutNormalize(" 076.123.456 - k ")).toBe("76123456-K");
    expect(rutNormalize("8.638.298-9")).toBe("8638298-9");
  });

  it("no valida: un verificador equivocado se normaliza igual", () => {
    expect(rutNormalize("76.123.456-0")).toBe("76123456-0");
  });

  it("vacio o de un caracter queda como esta", () => {
    expect(rutNormalize("")).toBe("");
    expect(rutNormalize(null)).toBe("");
    expect(rutNormalize(undefined)).toBe("");
    expect(rutNormalize("k")).toBe("K");
  });
});

describe("rutCheckDigit", () => {
  it("calcula el verificador, incluidos 0 y K", () => {
    expect(rutCheckDigit("77115769")).toBe("6");
    expect(rutCheckDigit(8638298)).toBe("9");
    expect(rutCheckDigit("78137000")).toBe("2");
    expect(rutCheckDigit("11111111")).toBe("1");
    expect(rutCheckDigit("6")).toBe("K");
    expect(rutCheckDigit("77915170")).toBe("0");
  });
});

describe("rutIsValid", () => {
  it("valida el verificador en cualquier formato", () => {
    expect(rutIsValid("77.115.769-6")).toBe(true);
    expect(rutIsValid("77115769-6")).toBe(true);
    expect(rutIsValid("771157696")).toBe(true);
    expect(rutIsValid("77.915.170-0")).toBe(true);
    expect(rutIsValid("6-k")).toBe(true);
  });

  it("rechaza el verificador equivocado y lo que no tiene forma de RUT", () => {
    expect(rutIsValid("77.115.769-5")).toBe(false);
    expect(rutIsValid("")).toBe(false);
    expect(rutIsValid(null)).toBe(false);
    expect(rutIsValid("ABC-1")).toBe(false);
    expect(rutIsValid("1234567890-1")).toBe(false);
  });
});

describe("rutEquals", () => {
  it("compara sin importar el formato", () => {
    expect(rutEquals("76.123.456-k", "76123456K")).toBe(true);
    expect(rutEquals("076123456-K", "76123456-k")).toBe(true);
    expect(rutEquals("76123456-K", "76123457-K")).toBe(false);
  });

  it("un RUT vacio no es igual a nada, ni a otro vacio", () => {
    expect(rutEquals("", "")).toBe(false);
    expect(rutEquals(null, undefined)).toBe(false);
    expect(rutEquals("", "76123456-K")).toBe(false);
  });
});
