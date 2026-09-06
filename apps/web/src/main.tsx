import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { enableCrossWindowSync } from './global/lib/crossWindowSync'
import { subscribeAuthEvents, useUserStore } from './global/stores/useUserStore'
import './index.css'

enableCrossWindowSync()
subscribeAuthEvents()
void useUserStore.getState().restoreSession()

const root = document.querySelector('#root')
if (!root) throw new Error('Could not find root node')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
