import Sidebar from '@/components/ui/Sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto" style={{ background: 'var(--cream)' }}>{children}</main>
    </div>
  )
}
