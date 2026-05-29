import { createContext, useContext, useState } from "react";

const FeedbackContext = createContext(null);

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: "Confirm Action",
    message: "",
    resolve: null,
  });

  const showToast = (message, type = "info") => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((current) => [...current, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 2800);
  };

  const confirm = (message, title = "Confirm Action") =>
    new Promise((resolve) => {
      setConfirmState({
        open: true,
        title,
        message,
        resolve,
      });
    });

  const closeConfirm = (accepted) => {
    confirmState.resolve?.(accepted);
    setConfirmState({
      open: false,
      title: "Confirm Action",
      message: "",
      resolve: null,
    });
  };

  const value = {
    showToast,
    confirm,
  };

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => {
          const colors =
            toast.type === "success"
              ? "border-emerald-600 bg-white text-slate-900"
              : toast.type === "warning"
                ? "border-amber-600 bg-white text-slate-900"
                : toast.type === "error"
                  ? "border-rose-600 bg-white text-slate-900"
                  : "border-slate-700 bg-white text-slate-900";
          return (
            <div
              key={toast.id}
              className={`fade-in-up pointer-events-auto flex items-center gap-3 rounded-xl border-l-4 p-3 text-xs font-semibold shadow-xl ${colors}`}
            >
              <span>{toast.message}</span>
            </div>
          );
        })}
      </div>

      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm transition-all duration-200 ${
          confirmState.open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div
          className={`w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl transition-all duration-200 ${
            confirmState.open ? "scale-100" : "scale-95"
          }`}
        >
          <div className="p-5 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-900">
              {confirmState.title}
            </h3>
            <p className="mb-6 text-xs text-slate-600">{confirmState.message}</p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => closeConfirm(false)}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => closeConfirm(true)}
                className="rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-slate-800"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error("useFeedback must be used within FeedbackProvider");
  }
  return context;
}
