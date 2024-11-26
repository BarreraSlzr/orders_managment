import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { OrderContextType } from '@/lib/types';

export function FilterControls({ searchQuery, visibleTags, selectedTags, setSearchQuery, setSelectedTags, resetFilters }: 
  Pick<OrderContextType, 'searchQuery' | 'visibleTags' | 'selectedTags' | 'setSearchQuery' | 'setSelectedTags' | 'resetFilters'>
) {
  const handleTagToggle = (tag: string) => {
    selectedTags.has(tag) ? selectedTags.delete(tag) : selectedTags.add(tag);
    setSelectedTags(new Set(selectedTags));
  };

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
        {visibleTags.map(([tag]) => (
          <Badge
            key={tag}
            variant={selectedTags.has(tag) ? 'default' : 'outline'}
            onClick={() => handleTagToggle(tag)}
          >
            {tag}
          </Badge>
        ))}
      </div>
      <Button type="reset">Limpiar</Button>
    </form>
  );
}
