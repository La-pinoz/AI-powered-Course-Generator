export default function ErrorMessage({ message, onRetry }) {
  return (
    <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-800">
      <p className="text-sm font-medium">{message || 'Something went wrong.'}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded bg-red-700 px-3 py-1 text-sm font-semibold text-white hover:bg-red-800"
        >
          Try again
        </button>
      )}
    </div>
  )
}
