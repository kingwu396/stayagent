import { X } from 'lucide-react'

interface FilterChipProps {
  label: string
  onRemove: () => void
}

export function FilterChip({ label, onRemove }: FilterChipProps) {
  return (
    <button
      onClick={onRemove}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-full text-sm text-slate-700 transition"
    >
      <span>{label}</span>
      <X className="w-3.5 h-3.5 text-slate-500" />
    </button>
  )
}
