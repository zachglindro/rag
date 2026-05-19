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
  const handleRef = useRef<HTMLDivElement>(null)
  const [isResizing, setIsResizing] = useState(false)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const target = e.currentTarget as HTMLDivElement
      target.setPointerCapture(e.pointerId)

      setIsResizing(true)
      const startX = e.clientX

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startX
        onResize(delta)
      }

      const handlePointerUp = (upEvent: PointerEvent) => {
        target.releasePointerCapture(upEvent.pointerId)
        setIsResizing(false)
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
      ref={handleRef}
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
