'use client' // Error boundaries must be Client Components

import { getClientLogsFromSession } from '@/lib/utils/logger'
import React from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    // global-error must include html and body tags
    <html>
      <body>
        <h2>Something went wrong!</h2>
        <pre>
          {JSON.stringify({
            logs: getClientLogsFromSession(),
            error
          })
          }
        </pre>
        <button onClick={() => reset()}>Try again</button>
      </body>
    </html>
  )
}