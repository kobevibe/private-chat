import { useAuth } from './hooks/useAuth'
import LoginScreen from './components/LoginScreen'
import ChatApp from './components/ChatApp'

export default function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-dvh w-full bg-[#090d16] items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <LoginScreen />

  return <ChatApp session={session} />
}
