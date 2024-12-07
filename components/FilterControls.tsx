import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { useProductsFilter } from '@/context/useProductsFilter';

export const colorsByIndex = ["bg-indigo-500", "bg-blue-500", "bg-sky-500", "bg-cyan-500"]

export function FilterControls() {
  const {
    searchQuery, tagsSorted, selectedTags, setSearchQuery, resetFilters, handleTagToggle
  } = useProductsFilter()

  return (
    <form onSubmit={(ev) => ev.preventDefault()} onReset={resetFilters}
      className='space-y-2 w-full'>
      <div className="relative">
        <Input
          name="search"
          placeholder="Search by name or tags..."
          className="pl-10 pr-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Button type="reset" variant="ghost" size="sm" className="absolute right-1 top-1/2 transform -translate-y-1/2">
          <X />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {tagsSorted.map(([tag,id]) => (
          <Badge
            key={tag}
            className={`${colorsByIndex[id]} ${selectedTags.has(tag) ? 'bg-black' : ''}`}
            onClick={() => handleTagToggle(tag)}
          >{tag}</Badge>
        ))}
      </div>
    </form>
  );
}
