import { useRef, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { GripVertical } from "lucide-react"

interface ColumnResizeHandleProps {
  onResize: (delta: number) => void
  columnLabel: string
  className?: string
}

export function ColumnResizeHandle({
  onResize,
  columnLabel,
  className,
}: ColumnResizeHandleProps) {
  const [isResizing, setIsResizing] = useState(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef<number>(0)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const target = e.currentTarget as HTMLDivElement
      target.setPointerCapture(e.pointerId)

      setIsResizing(true)
      startXRef.current = e.clientX
      // parent should be the TH element
      const parent = target.parentElement as HTMLElement | null
      startWidthRef.current = parent?.offsetWidth ?? 0

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startXRef.current
        const parent = target.parentElement as HTMLElement | null
        if (!parent) return

        const minWidth = 50
        const newWidth = Math.max(minWidth, startWidthRef.current + delta)
        parent.style.width = `${newWidth}px`
      }

      const handlePointerUp = (upEvent: PointerEvent) => {
        target.releasePointerCapture(upEvent.pointerId)
        setIsResizing(false)
        const finalDelta = upEvent.clientX - startXRef.current
        onResize(Math.max(finalDelta, 50 - startWidthRef.current))
        document.removeEventListener("pointermove", handlePointerMove)
        document.removeEventListener("pointerup", handlePointerUp)
      }

      document.addEventListener("pointermove", handlePointerMove)
      document.addEventListener("pointerup", handlePointerUp)
    },
    [onResize]
  )

  return (
    <div
      onPointerDown={handlePointerDown}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      className={cn(
        "absolute top-0 right-0 flex h-full w-5 cursor-col-resize items-center justify-center transition-colors select-none hover:bg-muted/50",
        isResizing && "bg-muted/50",
        className
      )}
      title={`Resize ${columnLabel}`}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground opacity-40 transition-opacity hover:opacity-80" />
    </div>
  )
}
