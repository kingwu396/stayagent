interface PriceBreakdownProps {
  pricePerNight: number       // 每晚价
  nights: number              // 入住晚数
  cleaningFee: number         // 清洁费（固定）
  serviceFee: number          // 服务费（固定）
}

/** 格式化：千分位 + ¥ */
function fmt(n: number): string {
  if (!Number.isFinite(n)) return '¥0'
  return `¥${Math.round(n).toLocaleString('en-US')}`
}

/** 价格拆解（charter §3 示例格式） */
export function PriceBreakdown({
  pricePerNight,
  nights,
  cleaningFee,
  serviceFee,
}: PriceBreakdownProps) {
  const safeNights = Math.max(0, Math.floor(nights))
  const subtotal = pricePerNight * safeNights
  const total = subtotal + cleaningFee + serviceFee

  if (safeNights < 1) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-slate-500 italic">请选择入住和退房日期</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 text-sm">
      <Row
        label={`${fmt(pricePerNight)} x ${safeNights}晚`}
        value={fmt(subtotal)}
      />
      <Row label="清洁费" value={fmt(cleaningFee)} />
      <Row label="服务费" value={fmt(serviceFee)} />
      <div className="border-t border-slate-200 pt-3 mt-3">
        <Row label="总计" value={fmt(total)} bold />
      </div>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? 'font-bold text-base text-slate-900' : 'text-slate-700'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
