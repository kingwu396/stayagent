/**
 * DB 英文键 → 展示中文。
 * property_type / amenities 键保留英文（筛选与 JSON 匹配依赖），仅在渲染层转中文。
 */

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartment: '公寓',
  house: '民居',
  villa: '别墅',
  hotel: '酒店',
  studio: '工作室',
}

export function propertyTypeLabel(type: string | undefined | null): string {
  if (!type) return ''
  return PROPERTY_TYPE_LABELS[type] ?? type
}
