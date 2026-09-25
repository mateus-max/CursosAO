/* =========================================================
   APSAN ACADEMY
   MAIN.JS
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    const loginForm = document.getElementById("loginForm");

    if (loginForm) {

        loginForm.addEventListener("submit", function (event) {

            event.preventDefault();

            const username =
                document.getElementById("username").value.trim();

            const password =
                document.getElementById("password").value.trim();

            const userType =
                document.getElementById("userType").value;

            const message =
                document.getElementById("loginMessage");


            /* Verificação básica */

            if (!username || !password || !userType) {

                message.textContent =
                    "Preencha todos os campos.";

                return;
            }


            /* =================================================
               ENCAMINHAMENTO DOS UTILIZADORES
               ================================================= */

            if (userType === "direcao") {

                window.location.href = "direcao.html";

            } else if (userType === "professor") {

                window.location.href = "professor.html";

            } else if (userType === "aluno") {

                window.location.href = "aluno.html";

            } else {

                message.textContent =
                    "Tipo de acesso inválido.";
            }

        });
    }


    /* =========================================================
       BOTÃO VOLTAR
       ========================================================= */

    const backButtons =
        document.querySelectorAll("[data-back]");

    backButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            if (window.history.length > 1) {

                window.history.back();

            } else {

                window.location.href = "index.html";
            }

        });

    });


    /* =========================================================
       MENU MOBILE
       ========================================================= */

    const menuButton =
        document.querySelector("[data-menu-button]");

    const sideMenu =
        document.querySelector("[data-side-menu]");

    if (menuButton && sideMenu) {

        menuButton.addEventListener("click", function () {

            sideMenu.classList.toggle("menu-open");

        });

    }


    /* =========================================================
       FECHAR MENU AO CLICAR NUM LINK
       ========================================================= */

    const menuLinks =
        document.querySelectorAll("[data-menu-link]");

    menuLinks.forEach(function (link) {

        link.addEventListener("click", function () {

            if (sideMenu) {

                sideMenu.classList.remove("menu-open");

            }

        });

    });

});
