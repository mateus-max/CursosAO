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

        const studentSource =
            JSON.parse(localStorage.getItem("apsan_teacher_students") || "[]");

        const students =
            Array.isArray(studentSource)
                ? studentSource.filter(function (student) {
                    return (
                        student &&
                        (
                            student.teacherPhone === professorPhone ||
                            student.teacherPhone === (account && account.phone) ||
                            student.status === "confirmed"
                        )
                    );
                })
                : [];

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
                        '<small>' + escapeModuleText(material.type || "Material") + ' ' + link + '</small></div>' +
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
                            '<small>' + escapeModuleText(lesson.time) + ' · ' + escapeModuleText(lesson.duration || "60") + ' min</small></div>' +
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
            const panel = document.getElementById(
                type === "lesson" ? "lessonPanel" : "materialPanel"
            );
            if (panel) panel.classList.add("professor-panel-open");
        });
    });

    document.querySelectorAll("[data-close-panel]").forEach(function (button) {
        button.addEventListener("click", function () {
            const type = button.getAttribute("data-close-panel");
            const panel = document.getElementById(
                type === "lesson" ? "lessonPanel" : "materialPanel"
            );
            if (panel) panel.classList.remove("professor-panel-open");
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
                date: date,
                time: time,
                duration: duration
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
                link: link
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

    renderProfessorModules();


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
