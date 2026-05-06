import js from "@eslint/js";
import nextPlugin from "eslint-config-next";

const nextConfig = nextPlugin;

export default [
    js.configs.recommended,
    ...(Array.isArray(nextConfig) ? nextConfig : [nextConfig]),
    {
        ignores: [".next/**", "node_modules/**", "scripts/**", "public/**", "scratch/**", "*.bak"]
    }
];