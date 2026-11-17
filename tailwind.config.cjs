// Rebuild tailwind.css with: npx tailwindcss@3.4.19 -o tailwind.css
module.exports = {
      content: ['./index.html', './app.js', './admin.js'],
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            bgDark: '#131126',
            cardDark: '#1b1834',
            borderDark: '#2a264e',
            neonGreen: '#52e085',
            neonGreenHover: '#3fd073',
            neonPurple: '#a855f7',
            neonYellow: '#eab308',
            neonRed: '#ef4444',
            neonBlue: '#3b82f6'
          },
          fontFamily: {
            sans: ['Inter', 'sans-serif'],
          }
        }
      }
    };
