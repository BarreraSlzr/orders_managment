import * as React from 'react';
import Tag from './Tag';
import { cn } from '@/lib/utils';

export interface ITagListProps {
    tags: [string, number][]
}

const colorsByIndex = ["bg-indigo-500", "bg-blue-500", "bg-sky-500", "bg-cyan-500"]

export default function TagList({tags}: ITagListProps) {
    return (
        <div className="flex flex-wrap gap-2">{
            tags.map(([tag, id]) => <Tag key={tag} tag={tag} className={`${colorsByIndex[id]} text-sm h-6 active:data-[state=off]:${colorsByIndex[id]} hover:data-[state=off]:${colorsByIndex[id]}`}/>)
        }</div>
    )
}
