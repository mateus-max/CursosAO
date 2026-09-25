document.addEventListener("DOMContentLoaded", function () {

    /* ==========================================
       LOGIN
       ========================================== */

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


            if (!username || !password || !userType) {

                message.textContent =
                    "Preencha todos os campos.";

                return;
            }


            /*
             * Guardamos temporariamente os dados
             * do utilizador.
             */

            localStorage.setItem(
                "apsan_username",
                username
            );

            localStorage.setItem(
                "apsan_user_type",
                userType
            );


            /*
             * ABRIR O PAINEL DE ACORDO
             * COM O PERFIL ESCOLHIDO.
             */

            switch (userType) {

                case "direcao":

                    window.location.href =
                        "direcao.html";

                    break;


                case "professor":

                    window.location.href =
                        "professor.html";

                    break;


                case "aluno":

                    window.location.href =
                        "aluno.html";

                    break;


                default:

                    message.textContent =
                        "Selecione um perfil válido.";

            }

        });
    }


    /* ==========================================
       BOTÕES DE VOLTAR / SAIR
       ========================================== */

    const backButtons =
        document.querySelectorAll("[data-back]");

    backButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            localStorage.removeItem("apsan_username");
            localStorage.removeItem("apsan_user_type");

            window.location.href = "index.html";

        });

    });


    /* ==========================================
       NOME DO UTILIZADOR
       ========================================== */

    const userNameElements =
        document.querySelectorAll("[data-user-name]");

    const savedUsername =
        localStorage.getItem("apsan_username");

    userNameElements.forEach(function (element) {

        if (savedUsername) {

            element.textContent = savedUsername;

        }

    });


    /* ==========================================
       MENU
       ========================================== */

    const menuButton =
        document.querySelector("[data-menu-button]");

    const sideMenu =
        document.querySelector("[data-side-menu]");

    if (menuButton && sideMenu) {

        menuButton.addEventListener("click", function () {

            sideMenu.classList.toggle("menu-open");

        });

    }

});
