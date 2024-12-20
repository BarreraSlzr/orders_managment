import React, { useState } from 'react';
import { Plus, Trash2, Edit } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useInventory } from '@/context/InventoryProvider';
import { useOnLongPress } from '@/hooks/useOnLongPress';
import { Toggle } from '../ui/toggle';

export function CategorizedCardList() {
  const { categories, selectedCategory, deleteCategory, updateCategory, setSelectedCategory } = useInventory();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { endPress, startPress } = useOnLongPress()

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement;
    const submitType = submitter.id;

    if (submitType === 'update') {
      updateCategory(formData);
      setIsEditDialogOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* <div className="flex justify-between items-center gap-4">
        <h2 className="text-2xl font-bold">Categorias</h2>
        
      </div> */}
      <div className="flex flex-row flex-wrap gap-4">
        <Toggle className='border-2 data-[state=on]:border-blue-600 data-[state=on]:text-blue-600' data-state={!selectedCategory ? 'on' : 'off'} onClick={() => setSelectedCategory(null)}>Todos</Toggle>
        {categories.map((category) => (
          <Toggle key={category.id} className="select-none cursor-pointer border-2 data-[state=on]:border-blue-600 data-[state=on]:text-blue-600"
            onMouseDown={startPress(() => {
              setSelectedCategory(category);
              setIsEditDialogOpen(true)
            })}
            onMouseUp={endPress}
            onMouseLeave={endPress}
            onTouchStart={startPress(() => {
              setSelectedCategory(category);
              setIsEditDialogOpen(true)
            })}
            onTouchEnd={endPress}
            data-state={selectedCategory?.id === category.id ? 'on' : 'off'}
            onClick={() => setSelectedCategory(selectedCategory?.id === category.id ? null : category)}>
              {category.name}
          </Toggle>
        ))}
        <Button size='icon' variant='outline' onClick={() => {
          setSelectedCategory(null);
          setIsEditDialogOpen(true);
        }}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedCategory ? 'Editar ' : 'Agregar '}Categoria</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className='flex flex-col gap-2'>
            <Input
              name='name'
              id='name'
              placeholder="Ingresa nombre de categoria"
              defaultValue={selectedCategory?.name || ''}
            />
            <DialogFooter>
              {selectedCategory &&
                <Button type='reset' variant="destructive" onClick={() => deleteCategory(selectedCategory.id)}>
                  <Trash2 className="w-4 h-4 mr-1" />Eliminar
                </Button>
              }
              <Button type='reset' variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" id='update'>Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
