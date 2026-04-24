/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    screens: {
      sm:  '640px',
      md:  '1024px',
      lg:  '1280px',
      xl:  '1536px',
      '2xl': '1792px',
    },
    extend: {},
  },
  plugins: [],
}

