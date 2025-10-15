/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // 이 부분을 이렇게 수정해 주세요.
  ],
  theme: {
    extend: {
      fontFamily: {
        thirthy: ['Thirthy', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

