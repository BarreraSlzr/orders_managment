import * as React from 'react';
import { Toggle } from '../ui/toggle';
import { useProductsFilter } from '@/context/useProductsFilter';

export interface ITagProps {
    tag: string,
    className?: string
}

export default function Tag({ tag, className }: ITagProps) {
    const { handleTagToggle, selectedTags } = useProductsFilter();
    return (
        <Toggle
            key={tag}
            className={`${className} text-white`}
            pressed={selectedTags.has(tag)}
            onPressedChange={() => handleTagToggle(tag)}
        >{tag}</Toggle>
    );
}
