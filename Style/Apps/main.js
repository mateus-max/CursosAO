document.addEventListener("DOMContentLoaded", function () {


    /* =====================================================
       CONTAS DA PLATAFORMA — FONTE PRINCIPAL
       ===================================================== */

    function normalizePhone(value) {
        return String(value || "").replace(/\D/g, "");
    }

    function readAccountsRegistry() {
        try {
            const raw = JSON.parse(localStorage.getItem("apsan_accounts") || "[]");
            return Array.isArray(raw) ? raw : [];
        } catch (error) {
            return [];
        }
    }

    function saveAccountsRegistry(accounts) {
        localStorage.setItem("apsan_accounts", JSON.stringify(accounts));
        return accounts;
    }

    function ensureAccountRegistry() {
        let accounts = readAccountsRegistry();

        /* Migração segura: a conta antiga entra somente se ainda não existir. */
        try {
            const legacy = JSON.parse(localStorage.getItem("apsan_account") || "null");
            if (legacy && legacy.phone) {
                const legacyPhone = normalizePhone(legacy.phone);
                const exists = accounts.some(function (item) {
                    return normalizePhone(item && item.phone) === legacyPhone &&
                        String(item && item.type || "") === String(legacy.type || "");
                });

                if (!exists) {
                    accounts.push(Object.assign({}, legacy, {
                        id: legacy.id || ("acc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8))
                    }));
                }
            }
        } catch (error) {
            /* mantém o catálogo existente */
        }

        let changed = false;
        accounts = accounts.filter(function (item) {
            return item && typeof item === "object";
        }).map(function (item) {
            if (!item.id) {
                changed = true;
                return Object.assign({}, item, {
                    id: "acc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8)
                });
            }
            return item;
        });

        if (changed || localStorage.getItem("apsan_accounts") === null) {
            saveAccountsRegistry(accounts);
        }

        return accounts;
    }

    function resolveCurrentAccount() {
        const accounts = ensureAccountRegistry();
        const phone = normalizePhone(localStorage.getItem("apsan_phone"));
        const type = localStorage.getItem("apsan_user_type") || "";

        if (phone) {
            const registered = accounts.find(function (item) {
                return normalizePhone(item && item.phone) === phone &&
                    (!type || String(item.type || "") === type);
            });

            if (registered) {
                localStorage.setItem("apsan_account", JSON.stringify(registered));
                return registered;
            }
        }

        try {
            const legacy = JSON.parse(localStorage.getItem("apsan_account") || "null");
            if (legacy && (!type || legacy.type === type)) {
                return legacy;
            }
        } catch (error) {
            /* sessão inválida */
        }

        return null;
    }


    /* =====================================================
       LOGIN
       ===================================================== */

    const loginForm = document.getElementById("loginForm");

    if (loginForm) {
        const userTypeInput = document.getElementById("userType");
        const phoneGroup = document.getElementById("phoneGroup");
        const phoneInput = document.getElementById("phone");
        const emailGroup = document.getElementById("emailGroup");
        const emailInput = document.getElementById("email");
        const passwordInput = document.getElementById("password");
        const createAccount = document.getElementById("createAccount");

        function configureLoginByRole() {
            const isDirection = userTypeInput && userTypeInput.value === "direcao";

            if (phoneGroup) phoneGroup.style.display = isDirection ? "none" : "grid";
            if (emailGroup) emailGroup.style.display = isDirection ? "grid" : "none";

            if (phoneInput) phoneInput.required = !isDirection;
            if (emailInput) emailInput.required = isDirection;

            if (passwordInput) {
                passwordInput.placeholder = isDirection
                    ? "Digite a palavra-passe da Direção"
                    : "Digite a sua palavra-passe";
            }

            if (createAccount) {
                createAccount.style.display = isDirection ? "none" : "block";
            }
        }

        if (userTypeInput) {
            userTypeInput.addEventListener("change", configureLoginByRole);
        }

        configureLoginByRole();

        loginForm.addEventListener("submit", function (event) {
            event.preventDefault();

            const userType = userTypeInput ? userTypeInput.value : "";
            const password = passwordInput ? passwordInput.value.trim() : "";
            const message = document.getElementById("loginMessage");

            /*
             * A Direção possui uma entrada própria.
             * Não usa o cadastro de alunos/professores.
             */
            if (userType === "direcao") {
                const email = emailInput
                    ? emailInput.value.trim().toLowerCase()
                    : "";

                if (!email || !password) {
                    message.textContent = "Informe o e-mail e a palavra-passe da Direção.";
                    return;
                }

                if (
                    email !== "suporte@apsanlda.com" ||
                    password !== "12suporte45"
                ) {
                    message.textContent = "E-mail ou palavra-passe da Direção incorretos.";
                    return;
                }

                const directionAccount = {
                    id: "direction_support",
                    name: "Direção APSAN Academy",
                    email: "suporte@apsanlda.com",
                    phone: "suporte@apsanlda.com",
                    type: "direcao"
                };

                localStorage.setItem(
                    "apsan_account",
                    JSON.stringify(directionAccount)
                );
                localStorage.setItem("apsan_phone", "suporte@apsanlda.com");
                localStorage.setItem("apsan_user_type", "direcao");
                localStorage.setItem("apsan_logged_in", "true");

                window.location.href = "Style/Apps/direcao.html";
                return;
            }

            const phoneInputValue = phoneInput
                ? phoneInput.value.trim()
                : "";
            const phone = normalizePhone(phoneInputValue);

            if (!phone || !password || !userType) {
                message.textContent = "Preencha todos os campos.";
                return;
            }

            let loginAccount = null;

            try {
                const accounts = ensureAccountRegistry();

                loginAccount = accounts.find(function (item) {
                    return (
                        item &&
                        normalizePhone(item.phone) === phone &&
                        item.password === password &&
                        item.type === userType
                    );
                }) || null;
            } catch (error) {
                loginAccount = null;
            }

            if (!loginAccount) {
                try {
                    const legacy = JSON.parse(
                        localStorage.getItem("apsan_account") || "null"
                    );

                    if (
                        legacy &&
                        legacy.password === password &&
                        legacy.type === userType &&
                        normalizePhone(legacy.phone) === phone
                    ) {
                        loginAccount = legacy;
                    }
                } catch (error) {
                    loginAccount = null;
                }
            }

            if (!loginAccount) {
                message.textContent =
                    "Número de telefone, palavra-passe ou perfil incorreto.";
                return;
            }

            localStorage.setItem(
                "apsan_account",
                JSON.stringify(loginAccount)
            );
            localStorage.setItem("apsan_phone", phone);
            localStorage.setItem("apsan_user_type", userType);
            localStorage.setItem("apsan_logged_in", "true");

            if (userType === "professor") {
                window.location.href = "Style/Apps/professor.html";
            } else if (userType === "aluno") {
                window.location.href = "Style/Apps/aluno.html";
            }
        });
    }

    /* O login é uma página própria. Depois de registar o evento de entrada,
       não executamos o código dos painéis nesta página. */
    if (loginForm) {
        return;
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

    account = resolveCurrentAccount();


    /* =====================================================
       PROTEÇÃO POR PERFIL
       ===================================================== */

    if (
        document.body.classList.contains("professor-page") &&
        (!account || account.type !== "professor")
    ) {
        window.location.href = "../../index.html";
        return;
    }

    if (
        document.body.classList.contains("student-page") &&
        (!account || account.type !== "aluno")
    ) {
        window.location.href = "../../index.html";
        return;
    }

    if (
        document.body.classList.contains("admin-page") &&
        (!account || account.type !== "direcao")
    ) {
        window.location.href = "../../index.html";
        return;
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

                    const accountsRegistry =
                        JSON.parse(localStorage.getItem("apsan_accounts") || "[]");

                    const registry = Array.isArray(accountsRegistry)
                        ? accountsRegistry
                        : [];

                    const accountIndex = registry.findIndex(function (item) {
                        return (
                            (updatedAccount.id && item.id === updatedAccount.id) ||
                            normalizePhone(item.phone) === normalizePhone(updatedAccount.phone)
                        );
                    });

                    if (accountIndex >= 0) {
                        /* Atualiza a mesma conta sem apagar nenhuma outra. */
                        registry[accountIndex] = Object.assign(
                            {},
                            registry[accountIndex],
                            updatedAccount,
                            { id: registry[accountIndex].id || updatedAccount.id }
                        );
                    } else {
                        registry.push(Object.assign({}, updatedAccount, {
                            id: updatedAccount.id || ("acc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8))
                        }));
                    }

                    localStorage.setItem(
                        "apsan_accounts",
                        JSON.stringify(registry)
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

                    const currentPublicProfile = getPublicProfile();

                    if (currentPublicProfile.published) {
                        currentPublicProfile.teacherName = account.name || "Professor";
                        currentPublicProfile.teacherPhoto = account.photo || "";
                        currentPublicProfile.updatedAt = new Date().toISOString();
                        savePublicProfile(currentPublicProfile);
                        renderPublicProfileStatus(currentPublicProfile);
                    }

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
       PERFIL PÚBLICO DO PROFESSOR
       ===================================================== */

    const publicProfilePanel =
        document.getElementById("publicProfilePanel");

    const publicProfileForm =
        document.getElementById("publicProfileForm");

    const publicCoverInput =
        document.getElementById("publicCoverInput");

    let pendingPublicCover = "";

    function professorProfileKey() {
        return "apsan_professor_profile_" +
            ((account && (account.phone || account.username)) || "default");
    }

    function getPublicProfile() {
        try {
            const profile = JSON.parse(
                localStorage.getItem(professorProfileKey()) || "null"
            );
            return profile || {};
        } catch (error) {
            return {};
        }
    }

    function savePublicProfile(profile) {
        localStorage.setItem(
            professorProfileKey(),
            JSON.stringify(profile)
        );

        const profiles =
            JSON.parse(localStorage.getItem("apsan_professors") || "[]");

        const list = Array.isArray(profiles) ? profiles : [];

        const index = list.findIndex(function (item) {
            return item.teacherPhone === profile.teacherPhone;
        });

        if (profile.published) {
            if (index >= 0) {
                list[index] = profile;
            } else {
                list.push(profile);
            }
        } else if (index >= 0) {
            list.splice(index, 1);
        }

        localStorage.setItem("apsan_professors", JSON.stringify(list));
    }

    function renderPublicProfileStatus(profile) {

        const title =
            document.getElementById("publicProfileStatusTitle");

        const description =
            document.getElementById("publicProfileStatusText");

        if (!title || !description) return;

        if (profile.published) {
            title.textContent = "Perfil publicado";
            description.textContent =
                "Os alunos já podem encontrar este perfil na pesquisa de professores.";
        } else {
            title.textContent = "Perfil ainda não publicado";
            description.textContent =
                "Configure as suas informações profissionais e publique para que os alunos o encontrem.";
        }
    }

    function loadPublicProfileForm() {

        if (!publicProfileForm) return;

        const profile = getPublicProfile();

        const values = {
            publicCourse: profile.course || "",
            publicDescription: profile.description || "",
            publicModality: profile.modality || "Online",
            publicPrice: profile.price || "",
            publicSchedules: profile.schedules || "",
            publicExperience: profile.experience || "",
            publicAdvantages: profile.advantages || ""
        };

        Object.keys(values).forEach(function (id) {
            const element = document.getElementById(id);
            if (element) element.value = values[id];
        });

        const published =
            document.getElementById("publicPublished");

        if (published) {
            published.checked = !!profile.published;
        }

        pendingPublicCover = profile.cover || "";

        const preview =
            document.getElementById("publicCoverPreview");

        if (preview) {
            if (pendingPublicCover) {
                preview.src = pendingPublicCover;
                preview.style.display = "block";
            } else {
                preview.removeAttribute("src");
                preview.style.display = "none";
            }
        }
    }

    if (publicCoverInput) {

        publicCoverInput.addEventListener("change", function (event) {

            const file = event.target.files[0];

            if (!file || !file.type.startsWith("image/")) return;

            const reader = new FileReader();

            reader.onload = function (e) {

                const image = new Image();

                image.onload = function () {

                    const maxWidth = 1200;
                    let width = image.naturalWidth;
                    let height = image.naturalHeight;

                    if (width > maxWidth) {
                        height = Math.round(height * maxWidth / width);
                        width = maxWidth;
                    }

                    const canvas = document.createElement("canvas");
                    canvas.width = width;
                    canvas.height = height;

                    const context = canvas.getContext("2d");
                    context.drawImage(image, 0, 0, width, height);

                    pendingPublicCover =
                        canvas.toDataURL("image/jpeg", 0.78);

                    const preview =
                        document.getElementById("publicCoverPreview");

                    if (preview) {
                        preview.src = pendingPublicCover;
                        preview.style.display = "block";
                    }
                };

                image.src = e.target.result;
            };

            reader.readAsDataURL(file);
        });
    }

    if (publicProfileForm) {

        publicProfileForm.addEventListener("submit", function (event) {

            event.preventDefault();

            const profileMessage =
                document.getElementById("publicProfileMessage");

            const profile = {
                teacherPhone: account && account.phone
                    ? account.phone
                    : (account && account.username) || "default",
                teacherName: account && account.name
                    ? account.name
                    : "Professor",
                teacherPhoto: account && account.photo
                    ? account.photo
                    : "",
                course: document.getElementById("publicCourse").value.trim(),
                description: document.getElementById("publicDescription").value.trim(),
                modality: document.getElementById("publicModality").value,
                price: document.getElementById("publicPrice").value.trim(),
                schedules: document.getElementById("publicSchedules").value.trim(),
                experience: document.getElementById("publicExperience").value.trim(),
                advantages: document.getElementById("publicAdvantages").value.trim(),
                cover: pendingPublicCover,
                published: document.getElementById("publicPublished").checked,
                updatedAt: new Date().toISOString()
            };

            if (
                !profile.course ||
                !profile.description ||
                !profile.schedules ||
                !profile.experience ||
                profile.price === ""
            ) {
                profileMessage.style.color = "#d93025";
                profileMessage.textContent =
                    "Preencha curso, descrição, preço, horários e experiência.";
                return;
            }

            try {

                savePublicProfile(profile);
                renderPublicProfileStatus(profile);

                profileMessage.style.color = "#16803c";
                profileMessage.textContent =
                    profile.published
                        ? "Perfil publicado com sucesso!"
                        : "Perfil guardado como não publicado.";

                setTimeout(function () {
                    if (publicProfilePanel) {
                        publicProfilePanel.classList.remove("professor-panel-open");
                    }
                    profileMessage.textContent = "";
                }, 900);

            } catch (error) {

                profileMessage.style.color = "#d93025";
                profileMessage.textContent =
                    "Não foi possível guardar o perfil.";
            }
        });
    }

    if (publicProfilePanel) {
        publicProfilePanel.addEventListener("click", function (event) {
            if (event.target === publicProfilePanel) {
                publicProfilePanel.classList.remove("professor-panel-open");
            }
        });
    }

    const publicProfileOpenButtons =
        document.querySelectorAll('[data-open-panel="publicProfile"]');

    publicProfileOpenButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            loadPublicProfileForm();
        });
    });

    renderPublicProfileStatus(getPublicProfile());


    /* =====================================================
       MÓDULOS DO PAINEL DO PROFESSOR
       ===================================================== */

    const professorPhone =
        localStorage.getItem("apsan_phone") || "default";

    const lessonsKey = "apsan_professor_lessons_" + professorPhone;
    const materialsKey = "apsan_professor_materials_" + professorPhone;

    function getStoredList(key) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || "[]");
            return Array.isArray(value) ? value : [];
        } catch (error) {
            return [];
        }
    }

    function saveStoredList(key, list) {
        localStorage.setItem(key, JSON.stringify(list));
    }

    function formatLessonDate(dateString) {
        if (!dateString) return "Data não definida";
        const date = new Date(dateString + "T00:00:00");
        return date.toLocaleDateString("pt-PT", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
    }

    function renderProfessorModules() {

        const lessons = getStoredList(lessonsKey);
        const materials = getStoredList(materialsKey);

        const legacyStudentSource =
            JSON.parse(localStorage.getItem("apsan_teacher_students") || "[]");

        let students = Array.isArray(legacyStudentSource)
            ? legacyStudentSource.filter(function (student) {
                return (
                    student &&
                    student.teacherPhone === professorPhone &&
                    (student.status === "confirmed" || student.status === "official")
                );
            })
            : [];

        /*
         * Matrículas oficiais confirmadas pela administração são a
         * fonte principal dos alunos do professor.
         */
        try {
            const enrollments = JSON.parse(
                localStorage.getItem("apsan_enrollments") || "[]"
            );

            if (Array.isArray(enrollments)) {
                const official = enrollments
                    .filter(function (item) {
                        return (
                            item &&
                            item.teacherPhone === professorPhone &&
                            item.status === "official"
                        );
                    })
                    .map(function (item) {
                        return {
                            id: item.id,
                            name: item.studentName,
                            studentName: item.studentName,
                            teacherPhone: item.teacherPhone,
                            status: "official"
                        };
                    });

                const combined = students.concat(official);
                const seen = {};
                students = combined.filter(function (item) {
                    const key = item.studentPhone || item.name || item.studentName;
                    if (seen[key]) return false;
                    seen[key] = true;
                    return true;
                });
            }
        } catch (error) {
            /* mantém os dados antigos se existirem */
        }

        const studentCount = document.getElementById("studentCount");
        const lessonCount = document.getElementById("lessonCount");
        const materialCount = document.getElementById("materialCount");
        const agendaCount = document.getElementById("agendaCount");
        const studentBadge = document.getElementById("studentBadge");

        if (studentCount) studentCount.textContent = students.length;
        if (studentBadge) studentBadge.textContent = students.length;
        if (lessonCount) lessonCount.textContent = lessons.length;
        if (materialCount) materialCount.textContent = materials.length;
        if (agendaCount) agendaCount.textContent = lessons.length;

        const studentsList = document.getElementById("studentsList");

        if (studentsList) {
            if (!students.length) {
                studentsList.innerHTML =
                    '<p class="empty-state">Os alunos oficiais aparecerão aqui após a matrícula e confirmação pela direção.</p>';
            } else {
                studentsList.innerHTML = students.map(function (student) {
                    const name = student.name || student.studentName || "Aluno";
                    return '<div class="module-row">' +
                        '<span class="module-row-icon">👤</span>' +
                        '<div><strong>' + escapeModuleText(name) + '</strong>' +
                        '<small>Aluno confirmado</small></div>' +
                        '</div>';
                }).join("");
            }
        }

        const materialsList = document.getElementById("materialsList");

        if (materialsList) {
            if (!materials.length) {
                materialsList.innerHTML =
                    '<p class="empty-state">Ainda não existem materiais guardados.</p>';
            } else {
                materialsList.innerHTML = materials.map(function (material) {
                    const link = material.link
                        ? '<a href="' + escapeModuleAttribute(material.link) + '" target="_blank" rel="noopener">Abrir</a>'
                        : "";
                    return '<div class="module-row">' +
                        '<span class="module-row-icon">📄</span>' +
                        '<div><strong>' + escapeModuleText(material.title) + '</strong>' +
                        '<small>' + escapeModuleText(material.type || "Material") + ' · ' +
                        escapeModuleText(material.course || "Curso") + '</small>' +
                        (material.description ? '<p>' + escapeModuleText(material.description) + '</p>' : '') +
                        ' ' + link + '</div>' +
                        '<button type="button" class="module-delete" data-delete-material="' + material.id + '">Excluir</button>' +
                        '</div>';
                }).join("");
            }
        }

        const agendaList = document.getElementById("agendaList");

        if (agendaList) {
            if (!lessons.length) {
                agendaList.innerHTML =
                    '<p class="empty-state">Ainda não existem aulas agendadas.</p>';
            } else {
                agendaList.innerHTML = lessons
                    .slice()
                    .sort(function (a, b) {
                        return (a.date + a.time).localeCompare(b.date + b.time);
                    })
                    .map(function (lesson) {
                        return '<div class="schedule-row">' +
                            '<span class="schedule-day">' + escapeModuleText(formatLessonDate(lesson.date)) + '</span>' +
                            '<div><strong>' + escapeModuleText(lesson.title) + '</strong>' +
                            '<small>' + escapeModuleText(lesson.time) + ' · ' + escapeModuleText(lesson.duration || "60") + ' min</small>' +
                            (lesson.description ? '<p>' + escapeModuleText(lesson.description) + '</p>' : '') +
                            '</div>' +
                            '<button type="button" class="module-delete" data-delete-lesson="' + lesson.id + '">Excluir</button>' +
                            '</div>';
                    }).join("");
            }
        }

        const nextTitle = document.getElementById("nextLessonTitle");
        const nextInfo = document.getElementById("nextLessonInfo");

        if (nextTitle && nextInfo) {
            const next = lessons
                .slice()
                .sort(function (a, b) {
                    return (a.date + a.time).localeCompare(b.date + b.time);
                })[0];

            if (next) {
                nextTitle.textContent = next.title;
                nextInfo.textContent =
                    formatLessonDate(next.date) +
                    " · " +
                    next.time +
                    " · " +
                    (next.duration || "60") +
                    " min";
            } else {
                nextTitle.textContent = "Nenhuma aula criada";
                nextInfo.textContent =
                    "Crie a sua primeira aula para ela aparecer aqui.";
            }
        }
    }

    function escapeModuleText(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function escapeModuleAttribute(value) {
        return escapeModuleText(value);
    }

    document.querySelectorAll("[data-open-panel]").forEach(function (button) {
        button.addEventListener("click", function () {
            const type = button.getAttribute("data-open-panel");

            const panelMap = {
                lesson: "lessonPanel",
                material: "materialPanel",
                publicProfile: "publicProfilePanel"
            };

            const panel = document.getElementById(
                panelMap[type] || ""
            );

            if (panel) {
                if (type === "publicProfile" &&
                    typeof loadPublicProfileForm === "function") {
                    loadPublicProfileForm();
                }

                panel.classList.add("professor-panel-open");
            }
        });
    });

    document.querySelectorAll("[data-close-panel]").forEach(function (button) {
        button.addEventListener("click", function () {
            const type = button.getAttribute("data-close-panel");

            const panelMap = {
                lesson: "lessonPanel",
                material: "materialPanel",
                publicProfile: "publicProfilePanel"
            };

            const panel = document.getElementById(
                panelMap[type] || ""
            );

            if (panel) {
                panel.classList.remove("professor-panel-open");
            }
        });
    });

    document.querySelectorAll(".professor-panel-overlay").forEach(function (panel) {
        panel.addEventListener("click", function (event) {
            if (event.target === panel) {
                panel.classList.remove("professor-panel-open");
            }
        });
    });

    const lessonForm = document.getElementById("lessonForm");

    if (lessonForm) {
        lessonForm.addEventListener("submit", function (event) {

            event.preventDefault();

            const title = document.getElementById("lessonTitle").value.trim();
            const date = document.getElementById("lessonDate").value;
            const time = document.getElementById("lessonTime").value;
            const duration = document.getElementById("lessonDuration").value;
            const description = document.getElementById("lessonDescription")
                ? document.getElementById("lessonDescription").value.trim()
                : "";
            const publicProfile = typeof getPublicProfile === "function"
                ? getPublicProfile()
                : null;
            const course = publicProfile && publicProfile.course
                ? publicProfile.course
                : "Curso do professor";
            const message = document.getElementById("lessonMessage");

            if (!title || !date || !time) {
                message.textContent = "Preencha a aula, data e hora.";
                message.style.color = "#d93025";
                return;
            }

            const lessons = getStoredList(lessonsKey);

            lessons.push({
                id: Date.now().toString(),
                title: title,
                description: description,
                date: date,
                time: time,
                duration: duration,
                course: course,
                teacherPhone: professorPhone,
                published: true,
                createdAt: new Date().toISOString()
            });

            saveStoredList(lessonsKey, lessons);
            renderProfessorModules();

            message.textContent = "Aula guardada com sucesso.";
            message.style.color = "#16803c";

            lessonForm.reset();

            setTimeout(function () {
                document.getElementById("lessonPanel").classList.remove("professor-panel-open");
                message.textContent = "";
            }, 700);
        });
    }

    const materialForm = document.getElementById("materialForm");

    if (materialForm) {
        materialForm.addEventListener("submit", function (event) {

            event.preventDefault();

            const title = document.getElementById("materialTitle").value.trim();
            const type = document.getElementById("materialType").value;
            const link = document.getElementById("materialLink").value.trim();
            const description = document.getElementById("materialDescription")
                ? document.getElementById("materialDescription").value.trim()
                : "";
            const publicProfile = typeof getPublicProfile === "function"
                ? getPublicProfile()
                : null;
            const course = publicProfile && publicProfile.course
                ? publicProfile.course
                : "Curso do professor";
            const message = document.getElementById("materialMessage");

            if (!title) {
                message.textContent = "Digite o nome do material.";
                message.style.color = "#d93025";
                return;
            }

            const materials = getStoredList(materialsKey);

            materials.push({
                id: Date.now().toString(),
                title: title,
                type: type,
                link: link,
                description: description,
                course: course,
                teacherPhone: professorPhone,
                published: true,
                createdAt: new Date().toISOString()
            });

            saveStoredList(materialsKey, materials);
            renderProfessorModules();

            message.textContent = "Material guardado com sucesso.";
            message.style.color = "#16803c";

            materialForm.reset();

            setTimeout(function () {
                document.getElementById("materialPanel").classList.remove("professor-panel-open");
                message.textContent = "";
            }, 700);
        });
    }

    document.addEventListener("click", function (event) {

        const deleteLessonButton =
            event.target.closest("[data-delete-lesson]");

        if (deleteLessonButton) {

            const id = deleteLessonButton.getAttribute("data-delete-lesson");

            const lessons = getStoredList(lessonsKey)
                .filter(function (lesson) {
                    return lesson.id !== id;
                });

            saveStoredList(lessonsKey, lessons);
            renderProfessorModules();
            return;
        }

        const deleteMaterialButton =
            event.target.closest("[data-delete-material]");

        if (deleteMaterialButton) {

            const id = deleteMaterialButton.getAttribute("data-delete-material");

            const materials = getStoredList(materialsKey)
                .filter(function (material) {
                    return material.id !== id;
                });

            saveStoredList(materialsKey, materials);
            renderProfessorModules();
        }
    });

    if (document.body.classList.contains("professor-page")) {
        renderProfessorModules();
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
