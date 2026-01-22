import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ImageLightbox({
  open,
  images,
  initialIndex,
  onClose,
  onDownload,
}: {
  open: boolean
  images: string[]
  initialIndex: number
  onClose: () => void
  onDownload?: (index: number) => void
}) {
  const safeImages = useMemo(() => (Array.isArray(images) ? images.filter(Boolean) : []), [images])
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (!open) return
    const start = Math.max(0, Math.min(safeImages.length - 1, Number(initialIndex || 0)))
    setIdx(start)
  }, [open, initialIndex, safeImages.length])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setIdx((v) => (v - 1 + safeImages.length) % Math.max(1, safeImages.length))
      if (e.key === 'ArrowRight') setIdx((v) => (v + 1) % Math.max(1, safeImages.length))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, safeImages.length])

  if (!open) return null
  if (!safeImages.length) return null

  const canNav = safeImages.length > 1
  const src = safeImages[idx]

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-white text-sm">{idx + 1} / {safeImages.length}</div>
          <div className="flex items-center gap-2">
            {onDownload && (
              <Button variant="secondary" size="sm" onClick={() => onDownload(idx)}>
                <Download className="h-4 w-4 mr-1" />
                下载
              </Button>
            )}
            <Button variant="secondary" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="relative rounded-lg overflow-hidden bg-black">
          <img src={src} alt="" className="w-full max-h-[80vh] object-contain" />

          {canNav && (
            <>
              <button
                className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 text-white hover:bg-black/60 flex items-center justify-center"
                onClick={() => setIdx((v) => (v - 1 + safeImages.length) % safeImages.length)}
                aria-label="上一张"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 text-white hover:bg-black/60 flex items-center justify-center"
                onClick={() => setIdx((v) => (v + 1) % safeImages.length)}
                aria-label="下一张"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
