import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { ToastContainer } from './components/Toast'
import { AgentFab } from './components/AgentFab'
import { AgentPanel } from './components/AgentPanel'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
    <ToastContainer />
    <AgentFab />
    <AgentPanel />
  </React.StrictMode>,
)
