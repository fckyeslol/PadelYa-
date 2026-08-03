import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Un guion bajo adelante marca lo que se declara pero no se usa a propósito:
  // parámetros que están sólo para respetar la firma de un callback o de una
  // interfaz. Sin esto no hay forma de distinguirlos de un descuido real.
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
  // Los scripts sueltos en .js son utilidades de Node en CommonJS que se corren
  // a mano (`node scripts/x.js`), no forman parte del bundle. `require()` es la
  // forma correcta ahí, así que la regla de TS no aplica.
  {
    files: ["scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
