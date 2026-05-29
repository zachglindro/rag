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
  const minWidthRef = useRef<number>(50)

  const getColumnMinWidth = useCallback(
    (header: HTMLElement, handle: HTMLDivElement) => {
      const styles = window.getComputedStyle(header)
      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")

      if (!context) {
        return 50
      }

      context.font = styles.font

      const horizontalPadding =
        parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight)
      const handleWidth = handle.offsetWidth
      const textWidth = context.measureText(columnLabel).width

      // Extra breathing room keeps text from touching the resize handle.
      return Math.ceil(textWidth + horizontalPadding + handleWidth + 4)
    },
    [columnLabel]
  )

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
      minWidthRef.current = parent ? getColumnMinWidth(parent, target) : 50

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startXRef.current
        const parent = target.parentElement as HTMLElement | null
        if (!parent) return

        const minWidth = minWidthRef.current
        const newWidth = Math.max(minWidth, startWidthRef.current + delta)
        parent.style.width = `${newWidth}px`
      }

      const handlePointerUp = (upEvent: PointerEvent) => {
        target.releasePointerCapture(upEvent.pointerId)
        setIsResizing(false)
        const finalDelta = upEvent.clientX - startXRef.current
        onResize(
          Math.max(finalDelta, minWidthRef.current - startWidthRef.current)
        )
        document.removeEventListener("pointermove", handlePointerMove)
        document.removeEventListener("pointerup", handlePointerUp)
      }

      document.addEventListener("pointermove", handlePointerMove)
      document.addEventListener("pointerup", handlePointerUp)
    },
    [getColumnMinWidth, onResize]
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
