/** Block 27: 房源发布 / 编辑表单
 *
 * 路由: /host/listings/new 和 /host/listings/:id/edit 复用同一组件.
 * - new: 空表单直接 POST
 * - edit: 先拉 GET /api/listings/{id} 回填, PATCH 部分更新
 *
 * 分区: 基本信息 / 房源类型 / 价格 / 房间配置 / 设施 / 图片
 * 图片走 POST /api/uploads/image (<= 5MB, jpeg/png/webp), 首图为封面.
 */
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ImagePlus, Loader2, Star, X } from 'lucide-react'
import { hostApi } from '@/api/host'
import { listingsApi } from '@/api/listings'
import { uploadsApi } from '@/api/uploads'
import { useToast } from '@/hooks/useToast'
import { ErrorState } from '@/components/ErrorState'
import { CounterRow } from '@/components/CounterRow'
import { propertyTypeLabel, amenityLabel } from '@/lib/labels'
import type { ListingFormData } from '@/types/host'
import { apiErrorText } from '@/lib/utils'

const PROPERTY_TYPES = ['apartment', 'house', 'villa', 'hotel', 'studio'] as const
const MAX_IMAGES = 10
/** 价格上限 (每晚价/清洁费/服务费统一封顶, 与后端 le 校验一致) */
const PRICE_MAX = 100000

const EMPTY_FORM: ListingFormData = {
  title: '',
  description: '',
  city: '',
  country: '',
  property_type: 'apartment',
  price_per_night: '',
  cleaning_fee: '0',
  service_fee: '0',
  max_guests: 2,
  bedrooms: 1,
  beds: 1,
  bathrooms: 1,
  amenities: [],
  images: [],
  latitude: '',
  longitude: '',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">{title}</h2>
      {children}
    </section>
  )
}

const inputCls =
  'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500'

export function HostListingFormView() {
  const { id } = useParams()
  const listingId = id ? Number(id) : null
  const isEdit = listingId !== null
  const navigate = useNavigate()
  const toast = useToast()

  const [loading, setLoading] = useState(true) // 初始加载 (edit 拉详情 + 设施选项)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<ListingFormData>(EMPTY_FORM)
  const [amenityOptions, setAmenityOptions] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function set<K extends keyof ListingFormData>(key: K, value: ListingFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  // 初始: edit 拉详情回填 + 拉设施候选 (filter-options 的高频设施)
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [options, detail] = await Promise.all([
          listingsApi.filterOptions(),
          isEdit && listingId ? listingsApi.getById(listingId) : Promise.resolve(null),
        ])
        if (cancelled) return
        setAmenityOptions(options.amenities_counts.map((a) => a.name))
        if (detail) {
          setForm({
            title: detail.title,
            description: detail.description ?? '',
            city: detail.city,
            country: detail.country,
            property_type: (PROPERTY_TYPES as readonly string[]).includes(detail.property_type)
              ? (detail.property_type as ListingFormData['property_type'])
              : 'apartment',
            price_per_night: detail.price_per_night,
            cleaning_fee: detail.cleaning_fee ?? '0',
            service_fee: detail.service_fee ?? '0',
            max_guests: detail.max_guests,
            bedrooms: detail.bedrooms,
            beds: detail.beds,
            bathrooms: detail.bathrooms,
            amenities: detail.amenities ?? [],
            images: detail.images ?? [],
            latitude: detail.latitude ?? '',
            longitude: detail.longitude ?? '',
          })
        }
        setLoading(false)
      } catch (err: any) {
        if (cancelled) return
        setError(apiErrorText(err, '加载失败'))
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [isEdit, listingId])

  async function handleUpload(file: File) {
    if (form.images.length >= MAX_IMAGES) {
      toast.error(`最多 ${MAX_IMAGES} 张图片`)
      return
    }
    setUploading(true)
    try {
      const res = await uploadsApi.uploadImage(file)
      set('images', [...form.images, res.url])
    } catch (err: any) {
      toast.error(apiErrorText(err, '图片上传失败'))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function removeImage(idx: number) {
    set(
      'images',
      form.images.filter((_, i) => i !== idx)
    )
  }

  /** 把第 idx 张挪到首位 (设为封面) */
  function makeCover(idx: number) {
    if (idx === 0) return
    const next = [form.images[idx], ...form.images.filter((_, i) => i !== idx)]
    set('images', next)
  }

  function toggleAmenity(name: string) {
    set(
      'amenities',
      form.amenities.includes(name)
        ? form.amenities.filter((a) => a !== name)
        : [...form.amenities, name]
    )
  }

  function validate(): string | null {
    if (!form.title.trim()) return '请填写标题'
    if (!form.city.trim()) return '请填写城市'
    if (!form.country.trim()) return '请填写国家/地区'
    if (!form.price_per_night || Number(form.price_per_night) <= 0) return '每晚价格需大于 0'
    if (Number(form.price_per_night) > PRICE_MAX) return `每晚价格不能超过 ¥${PRICE_MAX}`
    if (Number(form.cleaning_fee) > PRICE_MAX) return `清洁费不能超过 ¥${PRICE_MAX}`
    if (Number(form.service_fee) > PRICE_MAX) return `服务费不能超过 ¥${PRICE_MAX}`
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const v = validate()
    if (v) {
      toast.error(v)
      return
    }
    setSaving(true)
    // 经纬度留空时归一化为 null: 后端是 Decimal | None, 空串解析会 422
    const payload: ListingFormData = {
      ...form,
      latitude: form.latitude === '' ? null : form.latitude,
      longitude: form.longitude === '' ? null : form.longitude,
    }
    try {
      if (isEdit && listingId) {
        await hostApi.updateListing(listingId, payload)
        toast.success('房源已更新')
      } else {
        await hostApi.createListing(payload)
        toast.success('房源发布成功')
      }
      navigate('/host')
    } catch (err: any) {
      toast.error(apiErrorText(err, '保存失败'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="skeleton-shimmer h-8 w-40 rounded bg-slate-200 mb-6" />
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton-shimmer h-40 rounded-xl bg-slate-200" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <ErrorState description={error} onRetry={() => window.location.reload()} />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <Link
          to="/host"
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-600"
          aria-label="返回房东后台"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{isEdit ? '编辑房源' : '发布新房源'}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isEdit ? `房源 #${listingId}` : '发布后立即在前台可见'}
          </p>
        </div>
      </div>

      <Section title="基本信息">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">标题 *</label>
            <input
              className={inputCls}
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="如: 涩谷塔景精装公寓, 步行 5 分钟到地铁"
              maxLength={255}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">描述</label>
            <textarea
              className={inputCls + ' min-h-24'}
              value={form.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              placeholder="介绍房型、周边、入住体验…"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">城市 *</label>
              <input
                className={inputCls}
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
                placeholder="东京"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">国家/地区 *</label>
              <input
                className={inputCls}
                value={form.country}
                onChange={(e) => set('country', e.target.value)}
                placeholder="日本"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">纬度 (可选)</label>
              <input
                className={inputCls}
                value={form.latitude ?? ''}
                onChange={(e) => set('latitude', e.target.value)}
                placeholder="35.6762"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">经度 (可选)</label>
              <input
                className={inputCls}
                value={form.longitude ?? ''}
                onChange={(e) => set('longitude', e.target.value)}
                placeholder="139.6503"
              />
            </div>
          </div>
        </div>
      </Section>

      <Section title="房源类型">
        <div className="flex flex-wrap gap-2">
          {PROPERTY_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set('property_type', t)}
              className={
                'px-4 py-2 rounded-full text-sm border transition ' +
                (form.property_type === t
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-white text-slate-700 border-slate-300 hover:border-slate-900')
              }
            >
              {propertyTypeLabel(t)}
            </button>
          ))}
        </div>
      </Section>

      <Section title="价格 (¥)">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">每晚价格 *</label>
            <input
              type="number"
              min="1"
              max={PRICE_MAX}
              step="0.01"
              className={inputCls}
              value={form.price_per_night}
              onChange={(e) => set('price_per_night', e.target.value)}
              placeholder="680"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">清洁费</label>
            <input
              type="number"
              min="0"
              max={PRICE_MAX}
              step="0.01"
              className={inputCls}
              value={form.cleaning_fee}
              onChange={(e) => set('cleaning_fee', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">服务费</label>
            <input
              type="number"
              min="0"
              max={PRICE_MAX}
              step="0.01"
              className={inputCls}
              value={form.service_fee}
              onChange={(e) => set('service_fee', e.target.value)}
            />
          </div>
        </div>
      </Section>

      <Section title="房间配置">
        <CounterRow label="最多接待" value={form.max_guests} min={1} max={20}
          onChange={(n) => set('max_guests', n)} />
        <CounterRow label="卧室" value={form.bedrooms} min={1} max={20}
          onChange={(n) => set('bedrooms', n)} />
        <CounterRow label="床" value={form.beds} min={1} max={20}
          onChange={(n) => set('beds', n)} />
        <CounterRow label="卫生间" value={form.bathrooms} min={1} max={20}
          onChange={(n) => set('bathrooms', n)} />
      </Section>

      <Section title="便利设施">
        {amenityOptions.length === 0 ? (
          <p className="text-xs text-slate-400 italic">暂无候选设施数据</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {amenityOptions.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => toggleAmenity(name)}
                className={
                  'px-3 py-1.5 rounded-full text-xs border transition ' +
                  (form.amenities.includes(name)
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-slate-900')
                }
              >
                {amenityLabel(name)}
              </button>
            ))}
          </div>
        )}
      </Section>

      <Section title={`图片 (${form.images.length}/${MAX_IMAGES}, 第一张为封面)`}>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {form.images.map((url, idx) => (
            <div key={url} className="relative group aspect-square rounded-lg overflow-hidden bg-slate-100">
              <img src={url} alt={`图片 ${idx + 1}`} className="w-full h-full object-cover" />
              {idx === 0 && (
                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px]">
                  封面
                </span>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                {idx !== 0 && (
                  <button
                    type="button"
                    onClick={() => makeCover(idx)}
                    className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-amber-500 hover:bg-white"
                    aria-label="设为封面"
                    title="设为封面"
                  >
                    <Star className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-rose-500 hover:bg-white"
                  aria-label="删除图片"
                  title="删除图片"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {form.images.length < MAX_IMAGES && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="aspect-square rounded-lg border-2 border-dashed border-slate-300 hover:border-brand-500 flex flex-col items-center justify-center text-slate-400 hover:text-brand-500 transition disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <ImagePlus className="w-6 h-6" />
                  <span className="text-xs mt-1">上传图片</span>
                </>
              )}
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleUpload(f)
          }}
        />
        <p className="text-xs text-slate-400 mt-3">JPEG / PNG / WebP, 单张 ≤ 5MB</p>
      </Section>

      <div className="flex items-center gap-3 pb-8">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:bg-brand-300 text-white text-sm font-semibold rounded-xl transition"
        >
          {saving ? '保存中…' : isEdit ? '保存修改' : '发布房源'}
        </button>
        <Link
          to="/host"
          className="px-6 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-xl transition"
        >
          取消
        </Link>
      </div>
    </form>
  )
}
