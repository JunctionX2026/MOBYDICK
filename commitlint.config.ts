export default {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        "header-ascii": ({ header }: { header: string | null }) => [
          /^[\x20-\x7e]+$/.test(header ?? ""),
          "header must be written in English using ASCII characters",
        ],
      },
    },
  ],
  rules: {
    "header-ascii": [2, "always"],
    "scope-enum": [
      2,
      "always",
      ["web", "ui", "graph", "canvas", "serve", "catalog", "specs", "root"],
    ],
    "scope-empty": [2, "never"],
  },
};
