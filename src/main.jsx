import { GoogleOAuthProvider } from '@react-oauth/google'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

const GOOGLE_CLIENT_ID = '244024081996-kkb5ngla004bfrsd15oldoqbd1tb2dh3.apps.googleusercontent.com' // Replace with your actual Google Client ID

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
)
