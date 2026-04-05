import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Design System GestiCom
        primary: {
          DEFAULT: '#FF6B35', // Orange 🟠
          light: '#FF8C5A',
          dark: '#E5561E',
        },
        success: {
          DEFAULT: '#4CAF50', // Vert 🟢
          light: '#66BB6A',
          dark: '#388E3C',
        },
        info: {
          DEFAULT: '#2196F3', // Bleu 🔵
          light: '#42A5F5',
          dark: '#1976D2',
        },
        warning: {
          DEFAULT: '#FFC107', // Jaune 🟡
          light: '#FFD54F',
          dark: '#FFA000',
        },
        danger: {
          DEFAULT: '#F44336', // Rouge 🔴
          light: '#E57373',
          dark: '#D32F2F',
        },
        purple: {
          DEFAULT: '#9C27B0', // Violet 🟣
          light: '#BA68C8',
          dark: '#7B1FA2',
        },
        gray: {
          50: '#FAFAFA',
          100: '#F5F5F5',
          200: '#EEEEEE',
          300: '#E0E0E0',
          400: '#BDBDBD',
          500: '#9E9E9E',
          600: '#757575', // Gris principal ⚫
          700: '#616161',
          800: '#424242',
          900: '#212121',
        },
      },
    },
  },
  plugins: [],
};

export default config;
