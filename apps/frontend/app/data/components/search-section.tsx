// frontend/app/data/components/search-section.tsx
import { memo, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface SearchSectionProps {
  initialValue: string
  onSearch: (value: string) => void
  onClear: () => void
  isEditMode: boolean
  isMutating: boolean
  isSearchMode: boolean
}

const SearchSection = memo(function SearchSection({
  initialValue,
  onSearch,
  onClear,
  isEditMode,
  isMutating,
  isSearchMode,
}: SearchSectionProps) {
  const [inputValue, setInputValue] = useState(initialValue)

  useEffect(() => {
    setInputValue(initialValue)
  }, [initialValue])

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault()
      onSearch(inputValue)
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search"
          aria-label="Semantic search query"
          disabled={isEditMode || isMutating}
        />
        <div className="flex gap-2">
          <Button
            onClick={() => onSearch(inputValue)}
            disabled={
              inputValue.trim().length === 0 || isEditMode || isMutating
            }
          >
            Search
          </Button>
          <Button
            variant="outline"
            onClick={onClear}
            disabled={
              (!isSearchMode && inputValue.trim().length === 0) || isMutating
            }
          >
            Clear
          </Button>
        </div>
      </div>
    </div>
  )
})

export { SearchSection }