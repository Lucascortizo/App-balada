import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl' // 1. Importa o plugin

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    basicSsl(), // 2. Ativa o plugin
  ],
  server: {
    host: true,
  },
  base: '/App-balada/', 
})