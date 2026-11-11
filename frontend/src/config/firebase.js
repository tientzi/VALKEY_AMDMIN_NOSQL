import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyDJkkrdkip0nwsvMxhEO7NzgMx_CGwj760',
  authDomain: 'minimart-valkey.firebaseapp.com',
  projectId: 'minimart-valkey',
  storageBucket: 'minimart-valkey.firebasestorage.app',
  messagingSenderId: '996432631223',
  appId: '1:996432631223:web:9e1ed99399cde645abc432',
  measurementId: 'G-GTBGL4FT5H',
}

const firebaseApp = initializeApp(firebaseConfig)
export const firebaseAuth = getAuth(firebaseApp)
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

