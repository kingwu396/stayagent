import { Link } from 'react-router-dom'
import { UserMenu } from '@/components/UserMenu'

interface Props {
  title: string
  emoji: string
  blockNumber: string
}

export function PlaceholderView({ title, emoji, blockNumber }: Props) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold text-slate-900">← StayAgent</Link>
          <UserMenu />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="text-6xl mb-4">{emoji}</div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">{title}</h1>
        <p className="text-slate-500 mb-6">将在 <strong>{blockNumber}</strong> 完成</p>
        <Link to="/" className="text-brand-500 hover:text-brand-600 font-medium">
          ← 返回首页
        </Link>
      </main>
    </div>
  )
}
