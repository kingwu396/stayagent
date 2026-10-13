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

/** DB 英文设施键 → 展示中文 (与 FilterModal / AmenityList 文案保持一致) */
export const AMENITY_LABELS: Record<string, string> = {
  wifi: '无线网络',
  'air conditioning': '空调',
  tv: '电视机',
  parking: '免费停车',
  parking_free: '免费停车',
  dryer: '烘干机',
  gym: '健身房',
  kitchen: '厨房',
  washer: '洗衣机',
  pool: '游泳池',
  workspace: '工作区',
  heating: '暖气',
  'coffee maker': '咖啡机',
  garden: '花园',
  balcony: '阳台',
}

export function amenityLabel(name: string | undefined | null): string {
  if (!name) return ''
  return AMENITY_LABELS[name] ?? name
}
