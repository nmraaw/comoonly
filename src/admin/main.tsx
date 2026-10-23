import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import '../App.css'
import AdminApp from './AdminApp'

// Entry point of the admin interface (admin/index.html). The public app starts from src/main.tsx instead.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
)
