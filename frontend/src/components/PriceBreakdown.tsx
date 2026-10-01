interface PriceBreakdownProps {
  pricePerNight: number       // 每晚价
  nights: number              // 入住晚数
  cleaningFee: number         // 清洁费（固定）
  serviceFee: number          // 服务费（固定）
}

/** 格式化：2 位小数 + ¥（修复取整 bug，保证 subtotal+fees=total） */
function fmt(n: number): string {
  if (!Number.isFinite(n)) return '¥0.00'
  return `¥${n.toFixed(2)}`
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
    <div className="space-y-2.5 text-sm">
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
    <div className={`flex items-center justify-between ${bold ? 'font-bold text-base text-ink' : 'text-stone-600'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
