import '@fontsource-variable/newsreader/opsz.css'
import '@fontsource-variable/jetbrains-mono'
import '@fontsource-variable/source-sans-3'
import '@fontsource/poppins/400.css'
import '@fontsource/poppins/500.css'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'
import '@fontsource/poppins/700-italic.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import './styles/tokens.css'
import './styles/base.css'
import './styles/public.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
