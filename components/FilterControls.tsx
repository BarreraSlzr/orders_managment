import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TEST_IDS } from "@/lib/testIds";
import { Search, X } from "lucide-react";
import { useProductsFilter } from "@/context/useProductsFilter";
import TagList from "./Tag/List";

export function FilterControls() {
  const {
    searchQuery,
    tagsSorted,
    setSearchQuery,
    resetFilters,
  } = useProductsFilter();

  return (
    <form
      onSubmit={(ev) => ev.preventDefault()}
      onReset={resetFilters}
      className="space-y-2 w-full"
    >
      <div className="relative">
        <Input
          name="search"
          placeholder="Buscar por nombre de producto..."
          className="pl-10 pr-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          data-testid={TEST_IDS.FILTER_CONTROLS.SEARCH_INPUT}
        />
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Button
          type="reset"
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1/2 transform -translate-y-1/2"
          data-testid={TEST_IDS.FILTER_CONTROLS.RESET_BTN}
        >
          <X />
        </Button>
      </div>
      <TagList tags={tagsSorted} />
    </form>
  );
}
