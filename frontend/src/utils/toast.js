export const showToast = (message) => {
    // Check if toast already exists with same message to prevent spam
    const existing = Array.from(document.querySelectorAll(".toast"));
    if (existing.some(t => t.textContent === message)) return;

    const toast = document.createElement("div");
    toast.textContent = message;
    toast.className = "toast";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1500);
};
