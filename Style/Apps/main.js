document.addEventListener("DOMContentLoaded", function () {


    /* =====================================================
       LOGIN
       ===================================================== */

    const loginForm =
        document.getElementById("loginForm");


    if (loginForm) {

        loginForm.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();


                const phone =
                    document
                    .getElementById("phone")
                    .value
                    .trim();

                const password =
                    document
                    .getElementById("password")
                    .value
                    .trim();


                const userType =
                    document
                    .getElementById("userType")
                    .value;


                const message =
                    document
                    .getElementById("loginMessage");


                if (
                    !phone ||
                    !password ||
                    !userType
                ) {

                    message.textContent =
                        "Preencha todos os campos.";

                    return;
                }


                const accountData =
                    localStorage.getItem(
                        "apsan_account"
                    );


                if (accountData) {

                    const account =
                        JSON.parse(accountData);


                    if (
                        account.password !== password ||
                        account.type !== userType ||
                        (account.phone && account.phone !== phone)
                    ) {

                        message.textContent =
                            "Número de telefone, palavra-passe ou perfil incorreto.";

                        return;
                    }

                    /* Compatibilidade com contas criadas antes
                       da inclusão do número de telefone. */
                    if (!account.phone) {
                        account.phone = phone;
                        localStorage.setItem(
                            "apsan_account",
                            JSON.stringify(account)
                        );
                    }

                }


                localStorage.setItem(
                    "apsan_phone",
                    phone
                );

                localStorage.setItem(
                    "apsan_user_type",
                    userType
                );


                localStorage.setItem(
                    "apsan_logged_in",
                    "true"
                );


                if (userType === "direcao") {

                    window.location.href = "Style/Apps/direcao.html";

                }

                else if (userType === "professor") {

                    window.location.href = "Style/Apps/professor.html";

                }

                else if (userType === "aluno") {

                    window.location.href = "Style/Apps/aluno.html";

                }

            }
        );

    }



    /* =====================================================
       MENU LATERAL
       ===================================================== */

    const menuButton =
        document.querySelector(
            "[data-menu-button]"
        );


    const sideMenu =
        document.querySelector(
            "[data-side-menu]"
        );


    if (menuButton && sideMenu) {

        menuButton.addEventListener(
            "click",
            function () {

                sideMenu.classList.toggle(
                    "menu-open"
                );

            }
        );

    }



    /* =====================================================
       FECHAR MENU AO CLICAR
       ===================================================== */

    const menuLinks =
        document.querySelectorAll(
            "[data-menu-link]"
        );


    menuLinks.forEach(function (link) {

        link.addEventListener(
            "click",
            function () {

                if (sideMenu) {

                    sideMenu.classList.remove(
                        "menu-open"
                    );

                }

            }
        );

    });



    /* =====================================================
       DADOS DA CONTA
       ===================================================== */

    let account = null;
    let pendingProfilePhoto = null;


    const accountData =
        localStorage.getItem(
            "apsan_account"
        );


    if (accountData) {

        try {

            account =
                JSON.parse(accountData);

        }

        catch (error) {

            account = null;

        }

    }



    /* =====================================================
       ELEMENTOS DO PROFESSOR
       ===================================================== */

    const teacherName =
        document.getElementById(
            "teacherName"
        );


    const topAvatar =
        document.getElementById(
            "topAvatar"
        );


    const topAvatarLetter =
        document.getElementById(
            "topAvatarLetter"
        );

    const professorPhotoElements =
        document.querySelectorAll("[data-professor-photo]");



    /* =====================================================
       MOSTRAR DADOS NO PAINEL
       ===================================================== */

    function updateProfileDisplay() {

        if (!account) {
            return;
        }

        if (teacherName) {
            teacherName.textContent = account.name || "Professor";
        }

        const photo = account.photo || "";

        if (topAvatar) {
            if (photo) {
                topAvatar.src = photo;
                topAvatar.style.display = "block";
            } else {
                topAvatar.removeAttribute("src");
                topAvatar.style.display = "none";
            }
        }

        if (topAvatarLetter) {
            if (photo) {
                topAvatarLetter.style.display = "none";
            } else {
                topAvatarLetter.textContent =
                    (account.name || "P").charAt(0).toUpperCase();
                topAvatarLetter.style.display = "flex";
            }
        }

        professorPhotoElements.forEach(function (element) {
            if (photo) {
                element.src = photo;
                element.style.display = "block";
            } else {
                element.removeAttribute("src");
                element.style.display = "none";
            }
        });
    }


    updateProfileDisplay();



    /* =====================================================
       ABRIR PERFIL
       ===================================================== */

    const profileAvatarButton =
        document.getElementById(
            "profileAvatarButton"
        );


    const openProfileFromCard =
        document.getElementById(
            "openProfileFromCard"
        );


    const profileOverlay =
        document.getElementById(
            "profileOverlay"
        );


    const closeProfile =
        document.getElementById(
            "closeProfile"
        );


    function openProfile() {

        if (!profileOverlay) {
            return;
        }


        profileOverlay.classList.add(
            "profile-open"
        );


        const profileName =
            document.getElementById(
                "profileName"
            );


        const profileUsername =
            document.getElementById(
                "profileUsername"
            );


        const profileBio =
            document.getElementById(
                "profileBio"
            );


        const profilePassword =
            document.getElementById(
                "profilePassword"
            );


        const profilePhotoPreview =
            document.getElementById(
                "profilePhotoPreview"
            );


        const profilePhotoLetter =
            document.getElementById(
                "profilePhotoLetter"
            );


        pendingProfilePhoto = account && account.photo ? account.photo : null;

        if (account) {

            profileName.value =
                account.name || "";


            profileUsername.value =
                account.username || "";


            profileBio.value =
                account.bio || "";


            profilePassword.value =
                "";


            if (account.photo) {

                profilePhotoPreview.src =
                    account.photo;

                profilePhotoPreview.style.display =
                    "block";

                profilePhotoLetter.style.display =
                    "none";

            }

            else {

                profilePhotoPreview.style.display =
                    "none";

                profilePhotoLetter.textContent =
                    (account.name || "P")
                    .charAt(0)
                    .toUpperCase();

                profilePhotoLetter.style.display =
                    "flex";

            }

        }

    }


    if (profileAvatarButton) {

        profileAvatarButton.addEventListener(
            "click",
            openProfile
        );

    }


    if (openProfileFromCard) {

        openProfileFromCard.addEventListener(
            "click",
            openProfile
        );

    }



    /* =====================================================
       FECHAR PERFIL
       ===================================================== */

    if (closeProfile) {

        closeProfile.addEventListener(
            "click",
            function () {

                profileOverlay.classList.remove(
                    "profile-open"
                );

            }
        );

    }


    if (profileOverlay) {

        profileOverlay.addEventListener(
            "click",
            function (event) {

                if (
                    event.target ===
                    profileOverlay
                ) {

                    profileOverlay.classList.remove(
                        "profile-open"
                    );

                }

            }
        );

    }



    /* =====================================================
       CARREGAR FOTO
       ===================================================== */

    const profilePhotoInput =
        document.getElementById(
            "profilePhotoInput"
        );

    if (profilePhotoInput) {

        profilePhotoInput.addEventListener(
            "change",
            function (event) {

                const file = event.target.files[0];

                if (!file || !file.type.startsWith("image/")) {
                    return;
                }

                const reader = new FileReader();

                reader.onload = function (e) {

                    const originalPhoto = e.target.result;
                    const preview = document.getElementById("profilePhotoPreview");
                    const letter = document.getElementById("profilePhotoLetter");

                    /*
                     * Reduz a imagem antes de guardar no localStorage.
                     * Isto evita que fotos grandes façam o botão Salvar falhar.
                     */
                    const image = new Image();

                    image.onload = function () {

                        const maxSize = 600;
                        let width = image.naturalWidth;
                        let height = image.naturalHeight;

                        if (width > height && width > maxSize) {
                            height = Math.round(height * maxSize / width);
                            width = maxSize;
                        } else if (height >= width && height > maxSize) {
                            width = Math.round(width * maxSize / height);
                            height = maxSize;
                        }

                        const canvas = document.createElement("canvas");
                        canvas.width = width;
                        canvas.height = height;

                        const context = canvas.getContext("2d");
                        context.drawImage(image, 0, 0, width, height);

                        pendingProfilePhoto =
                            canvas.toDataURL("image/jpeg", 0.82);

                        if (preview) {
                            preview.src = pendingProfilePhoto;
                            preview.style.display = "block";
                        }

                        if (letter) {
                            letter.style.display = "none";
                        }
                    };

                    image.onerror = function () {
                        pendingProfilePhoto = originalPhoto;

                        if (preview) {
                            preview.src = originalPhoto;
                            preview.style.display = "block";
                        }

                        if (letter) {
                            letter.style.display = "none";
                        }
                    };

                    image.src = originalPhoto;
                };

                reader.readAsDataURL(file);
            }
        );
    }



    /* =====================================================
       SALVAR PERFIL
       ===================================================== */

    const profileForm =
        document.getElementById(
            "profileForm"
        );

    if (profileForm) {

        profileForm.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();

                const profileMessage =
                    document.getElementById("profileMessage");

                if (!account) {
                    if (profileMessage) {
                        profileMessage.style.color = "#d93025";
                        profileMessage.textContent =
                            "Não foi possível localizar a conta do professor.";
                    }
                    return;
                }

                const nameInput =
                    document.getElementById("profileName");

                const passwordInput =
                    document.getElementById("profilePassword");

                const profileName =
                    nameInput ? nameInput.value.trim() : "";

                const profilePassword =
                    passwordInput ? passwordInput.value.trim() : "";

                if (!profileName) {
                    if (profileMessage) {
                        profileMessage.style.color = "#d93025";
                        profileMessage.textContent = "Digite o seu nome.";
                    }
                    return;
                }

                if (
                    profilePassword &&
                    profilePassword.length < 6
                ) {
                    if (profileMessage) {
                        profileMessage.style.color = "#d93025";
                        profileMessage.textContent =
                            "A nova palavra-passe deve ter pelo menos 6 caracteres.";
                    }
                    return;
                }

                const updatedAccount = Object.assign({}, account);
                updatedAccount.name = profileName;

                if (pendingProfilePhoto) {
                    updatedAccount.photo = pendingProfilePhoto;
                }

                if (profilePassword) {
                    updatedAccount.password = profilePassword;
                }

                try {

                    const serializedAccount =
                        JSON.stringify(updatedAccount);

                    localStorage.setItem(
                        "apsan_account",
                        serializedAccount
                    );

                    const savedAccount =
                        JSON.parse(
                            localStorage.getItem("apsan_account")
                        );

                    if (!savedAccount) {
                        throw new Error("Conta não foi guardada.");
                    }

                    account = savedAccount;
                    pendingProfilePhoto = account.photo || null;

                    updateProfileDisplay();

                    if (profileMessage) {
                        profileMessage.style.color = "#16803c";
                        profileMessage.textContent =
                            "Perfil guardado com sucesso!";
                    }

                    setTimeout(function () {
                        if (profileOverlay) {
                            profileOverlay.classList.remove("profile-open");
                        }
                    }, 900);

                } catch (error) {

                    console.error("Erro ao guardar perfil:", error);

                    if (profileMessage) {
                        profileMessage.style.color = "#d93025";
                        profileMessage.textContent =
                            "Não foi possível guardar. Se a foto for muito grande, escolha outra imagem.";
                    }
                }
            }
        );
    }



    /* =====================================================
       SAIR
       ===================================================== */

    const logoutButton =
        document.getElementById(
            "logoutButton"
        );


    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            function () {

                localStorage.removeItem(
                    "apsan_logged_in"
                );


                localStorage.removeItem(
                    "apsan_username"
                );


                localStorage.removeItem(
                    "apsan_user_type"
                );


                window.location.href =
                    "index.html";

            }
        );

    }

});
