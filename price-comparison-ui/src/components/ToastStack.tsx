import { useEffect } from 'react'

export interface ToastItem {
  id: number
  title: string
  message: string
}

interface ToastStackProps {
  toasts: ToastItem[]
  onDismiss: (id: number) => void
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  useEffect(() => {
    const timers = toasts.map((toast) =>
      window.setTimeout(() => onDismiss(toast.id), 4200),
    )

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [toasts, onDismiss])

  if (toasts.length === 0) {
    return null
  }

  return (
    <aside className="toast-stack" aria-live="polite" aria-label="Notifications">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast-item" role="status">
          <div>
            <strong>{toast.title}</strong>
            <p>{toast.message}</p>
          </div>
          <button onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">
            Dismiss
          </button>
        </div>
      ))}
    </aside>
  )
}
