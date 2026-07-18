export function toast(message, type = "info") {
  const element = document.querySelector("#toast");
  if (!element) return;
  element.textContent = message;
  element.dataset.type = type;
  element.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove("show"), 2800);
}
export function explainError(error) {
  console.error(error);
  if (error?.code === "PERMISSION_DENIED" || error?.code === "permission-denied") return "權限不足，請確認你使用建立課堂時的同一個瀏覽器。";
  if (error?.code?.includes("network")) return "網路連線失敗，請稍後重試。";
  return error?.message || "發生未預期的錯誤。";
}
export function confirmAction(message) { return window.confirm(message); }
export function bindDialogClose(dialog) { dialog.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => dialog.close())); }
