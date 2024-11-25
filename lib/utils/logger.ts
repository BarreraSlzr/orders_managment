// logger.ts
export function initializeClientLogger() {
    // Intercept console methods to capture logs
    const originalConsole = { ...console };

    (['log', 'warn', 'error', 'info'] as ('log' | 'warn' | 'error' | 'info')[]).forEach((method) => {
        console[method] = (...args: unknown[]) => {
            // Call the original console method
            originalConsole[method](...args);

            // Store the log in Session Storage
            storeLogInSession({
                level: method,
                message: args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '),
                timestamp: new Date().toISOString(),
            });
        };
    });
}

function storeLogInSession(log: { level: string; message: string; timestamp: string }) {
    const sessionLogs = JSON.parse(sessionStorage.getItem('clientLogs') || '[]');
    sessionLogs.push(log);
    sessionStorage.setItem('clientLogs', JSON.stringify(sessionLogs));
}

// Utility to retrieve logs from Session Storage
export function getClientLogsFromSession(): { level: string; message: string; timestamp: string }[] {
    return JSON.parse(sessionStorage.getItem('clientLogs') || '[]');
}  