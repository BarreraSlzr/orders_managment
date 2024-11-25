
type ServerActionCallback<T> = () => Promise<T>;

interface ErrorHandlerProps<T> {
  actionName: string;
  callback: ServerActionCallback<T>;
  formData: FormData;
}

export async function errorHandler<T>({ actionName, callback, formData }: ErrorHandlerProps<T>): Promise<
  { success: true, message: string, result: T } |
  { success: false, message: string, result: null }
> {
  try {
    // Log the formData for inspection
    console.log(`Action: ${actionName} - Form Data: `, formData);

    // Execute the server action callback
    const result = await callback() as T;
    console.log(`Action: ${actionName} - Result: `, result);

    // Return success response
    return { success: true, message: `${actionName} successed`, result };
  } catch (error) {
    // Log the error for debugging
    console.error(`Error in ${actionName}: `, error);

    // You can provide custom error handling depending on the error type
    if (error instanceof Error) {
      // Handle database or known errors
      if (JSON.stringify(error).includes('23505')) {
        // Example: Handle unique constraint violations (PostgreSQL)
        return { success: false, message: 'Duplicate entry detected.', result: null };
      }

      // Generic database or unknown errors
      return { success: false, message: 'Database error occurred.', result: null };
    }

    // If the error is not an instance of Error, provide a fallback message
    return { success: false, message: 'An unknown error occurred.', result: null };
  }
}