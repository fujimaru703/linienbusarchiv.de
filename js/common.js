
document.addEventListener("DOMContentLoaded", async () => {

    const headerArea = document.getElementById("common-header");

    if (!headerArea) return;

    const root = headerArea.dataset.root || "./";

    try {
        const response = await fetch(
            root + "components/header.html"
        );

        if (!response.ok) {
            throw new Error("ヘッダーの読み込みに失敗");
        }

        let html = await response.text();

        // ページに応じて相対パスを変更
        html = html.replaceAll("{{ROOT}}", root);

        headerArea.innerHTML = html;

        // 現在のページを強調表示
        const currentPage = document.body.dataset.page;

        const activeLink = headerArea.querySelector(
            `.main-nav a[data-page="${currentPage}"]`
        );

        if (activeLink) {
            activeLink.classList.add("active");
            activeLink.setAttribute("aria-current", "page");
        }

    } catch (error) {
        console.error(error);
    }

});
