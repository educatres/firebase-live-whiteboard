export function toast(message, type = "info") {
  const element = document.querySelector("#toast");
  if (!element) return;
  element.textContent = message;
  element.dataset.type = type;
  element.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove("show"), 2800);
}
export function explainError(error, audience = "teacher") {
  console.error(error);
  if (error?.code === "PERMISSION_DENIED" || error?.code === "permission-denied") {
    return audience === "student"
      ? "無法使用此學生白板，請確認網址完整；若白板已綁定其他裝置或被老師鎖定，請聯絡老師。"
      : "權限不足，請使用老師連結並輸入六位數老師密鑰。";
  }
  if (error?.code?.includes("network")) return "網路連線失敗，請稍後重試。";
  return error?.message || "發生未預期的錯誤。";
}
export function confirmAction(message) { return window.confirm(message); }
export function bindDialogClose(dialog) { dialog.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => dialog.close())); }
