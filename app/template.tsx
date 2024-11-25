"use client"

import { initializeClientLogger } from "@/lib/utils/logger";
import { useEffect } from "react";


export default function Template({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        initializeClientLogger();
    }, [])
    return <div>{children}</div>
}