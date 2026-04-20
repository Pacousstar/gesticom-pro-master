import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
    js.configs.recommended,
    {
        files: ["**/*.{ts,tsx}"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                ecmaFeatures: {
                    jsx: true
                }
            },
            globals: {
                window: "readonly",
                document: "readonly",
                console: "readonly",
                process: "readonly",
                React: "readonly",
                JSX: "readonly"
            }
        },
        plugins: {
            "@typescript-eslint": tsPlugin
        },
        rules: {
            "no-unused-vars": "off", // Handled by TS
            "@typescript-eslint/no-unused-vars": ["warn", { 
                "argsIgnorePattern": "^_",
                "varsIgnorePattern": "^_"
            }],
            "no-undef": "off", // Handled by TS
            "no-console": "warn",
            "prefer-const": "warn",
            "react/react-in-jsx-scope": "off"
        }
    },
    {
        ignores: [
            ".next/**/*",
            "node_modules/**/*",
            "scripts/**/*",
            "public/**/*"
        ]
    }
];
