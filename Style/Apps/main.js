document.addEventListener("DOMContentLoaded", function () {


    /* =====================================================
       CONTAS DA PLATAFORMA — FONTE PRINCIPAL
       ===================================================== */

    function normalizePhone(value) {
        const digits = String(value || "").replace(/\D/g, "");
        return digits.length > 9 ? digits.slice(-9) : digits;
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

        let legacy = null;

        try {
            legacy = JSON.parse(localStorage.getItem("apsan_account") || "null");
        } catch (error) {
            legacy = null;
        }

        if (phone) {
            const registeredIndex = accounts.findIndex(function (item) {
                return normalizePhone(item && item.phone) === phone &&
                    (!type || String(item.type || "") === type);
            });

            if (registeredIndex >= 0) {
                const registered = accounts[registeredIndex];

                /*
                 * A conta principal e o registo da conta representam o mesmo
                 * professor. Ao iniciar sessão, juntamos os dados de perfil
                 * dos dois locais para não perder nome ou fotografia já
                 * atualizados no perfil.
                 */
                const merged = Object.assign({}, registered);

                if (legacy && (!type || legacy.type === type)) {
                    if (legacy.name && (!registered.name || registered.name === "Professor")) {
                        merged.name = legacy.name;
                    }

                    if (legacy.photo) {
                        merged.photo = legacy.photo;
                    } else if (legacy.profilePhoto) {
                        merged.photo = legacy.profilePhoto;
                    } else if (legacy.avatar) {
                        merged.photo = legacy.avatar;
                    }

                    if (legacy.bio && !registered.bio) {
                        merged.bio = legacy.bio;
                    }

                    if (legacy.username && !registered.username) {
                        merged.username = legacy.username;
                    }

                    if (legacy.password) {
                        merged.password = legacy.password;
                    }
                }

                /*
                 * Recupera também o perfil público antigo, caso o professor
                 * já tivesse guardado nome/fotografia antes da conta ter sido
                 * sincronizada com o catálogo de contas.
                 */
                try {
                    const profileKeys = [];
                    if (registered.phone) {
                        profileKeys.push("apsan_professor_profile_" + registered.phone);
                        profileKeys.push("apsan_professor_profile_" + normalizePhone(registered.phone));
                    }
                    if (registered.username) {
                        profileKeys.push("apsan_professor_profile_" + registered.username);
                    }

                    for (let i = 0; i < profileKeys.length; i++) {
                        const rawProfile = localStorage.getItem(profileKeys[i]);
                        if (!rawProfile) continue;

                        const oldProfile = JSON.parse(rawProfile);
                        if (!oldProfile) continue;

                        if ((!merged.name || merged.name === "Professor") &&
                            (oldProfile.teacherName || oldProfile.name)) {
                            merged.name = oldProfile.teacherName || oldProfile.name;
                        }

                        if (!merged.photo) {
                            merged.photo =
                                oldProfile.teacherPhoto ||
                                oldProfile.photo ||
                                oldProfile.profilePhoto ||
                                oldProfile.avatar ||
                                oldProfile.photoURL ||
                                "";
                        }

                        if (merged.name && merged.name !== "Professor" && merged.photo) break;
                    }
                } catch (error) {
                    /* mantém os dados já recuperados */
                }

                merged.id = registered.id || legacy && legacy.id || ("acc_" + Date.now());

                accounts[registeredIndex] = Object.assign({}, registered, merged);
                saveAccountsRegistry(accounts);

                localStorage.setItem("apsan_account", JSON.stringify(merged));
                return merged;
            }
        }

        if (legacy && (!type || legacy.type === type)) {
            return legacy;
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

        loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const userType = userTypeInput ? userTypeInput.value : "";
        const password = passwordInput ? passwordInput.value.trim() : "";
        const message = document.getElementById("loginMessage");

        if (!message) return;

        if (userType === "direcao") {
            const email = emailInput ? emailInput.value.trim().toLowerCase() : "";
            if (!email || !password) {
                message.textContent = "Informe o e-mail e a palavra-passe da Direção.";
                return;
            }

            /* A Direção usa exclusivamente a credencial administrativa existente.
             * Não existe cadastro de Direção e a autenticação administrativa
             * nunca pode criar uma nova conta Firebase automaticamente.
             */
            if (email !== "suporte@apsanlda.com" || password !== "12suporte45") {
                message.textContent = "E-mail ou palavra-passe da Direção incorretos.";
                return;
            }

            const directionAccount = {
                id: "direction_support",
                name: "Direção APSAN Academy",
                email: "suporte@apsanlda.com",
                phone: "suporte@apsanlda.com",
                type: "direcao",
                password: password
            };

            try {
                if (window.apsanCloud) {
                    const authUser = await window.apsanCloud.signIn(directionAccount, { allowCreate: false });
                    let savedDirectionProfile = {};
                    try {
                        savedDirectionProfile = JSON.parse(localStorage.getItem("apsan_direction_profile") || "{}") || {};
                    } catch (_) {}

                    const onlineDirection = Object.assign({}, directionAccount, {
                        name: savedDirectionProfile.name || "Direção APSAN Academy",
                        photo: savedDirectionProfile.logo || "",
                        nif: savedDirectionProfile.nif || "",
                        location: savedDirectionProfile.location || "",
                        authUid: authUser && authUser.uid ? authUser.uid : "",
                        authEmail: "suporte@apsanlda.com"
                    });

                    localStorage.setItem("apsan_account", JSON.stringify(onlineDirection));
                    localStorage.setItem("apsan_phone", "suporte@apsanlda.com");
                    localStorage.setItem("apsan_user_type", "direcao");
                    localStorage.setItem("apsan_logged_in", "true");
                    window.location.replace("Style/Apps/direcao-final.html?direction=final-20260927-01");
                    return;
                }
            } catch (_) {
                /* Compatibilidade com a entrada antiga enquanto a conta é migrada. */
            }

            if (email !== "suporte@apsanlda.com" || password !== "12suporte45") {
                message.textContent = "E-mail ou palavra-passe da Direção incorretos.";
                return;
            }

            let savedDirectionProfile = {};
            try {
                savedDirectionProfile = JSON.parse(localStorage.getItem("apsan_direction_profile") || "{}") || {};
            } catch (_) {}

            const legacyDirection = {
                id: "direction_support",
                name: savedDirectionProfile.name || "Direção APSAN Academy",
                email: "suporte@apsanlda.com",
                phone: "suporte@apsanlda.com",
                type: "direcao",
                photo: savedDirectionProfile.logo || "",
                nif: savedDirectionProfile.nif || "",
                location: savedDirectionProfile.location || ""
            };

            localStorage.setItem("apsan_account", JSON.stringify(legacyDirection));
            localStorage.setItem("apsan_phone", "suporte@apsanlda.com");
            localStorage.setItem("apsan_user_type", "direcao");
            localStorage.setItem("apsan_logged_in", "true");
            window.location.replace("Style/Apps/direcao-final.html?direction=final-20260927-01");
            return;
        }

        const phone = normalizePhone(phoneInput ? phoneInput.value.trim() : "");
        if (!phone || !password || !userType) {
            message.textContent = "Preencha todos os campos.";
            return;
        }

        message.textContent = "A ligar à plataforma...";

        let localAccount = null;
        let loginAccount = null;

        try {
            localAccount = ensureAccountRegistry().find(function(item) {
                return item &&
                    normalizePhone(item.phone) === phone &&
                    item.type === userType;
            }) || null;
        } catch (_) {}

        try {
            if (window.apsanCloud) {
                const onlineAccount = await window.apsanCloud.remoteAccount(phone, userType);
                if (onlineAccount) {
                    loginAccount = Object.assign({}, onlineAccount, { password: password });
                }
            }
        } catch (_) {}

        if (!loginAccount) loginAccount = localAccount;

        if (!loginAccount) {
            try {
                const legacy = JSON.parse(localStorage.getItem("apsan_account") || "null");
                if (legacy &&
                    legacy.type === userType &&
                    normalizePhone(legacy.phone) === phone) {
                    loginAccount = Object.assign({}, legacy, { password: password });
                }
            } catch (_) {}
        }

        if (!loginAccount) {
            message.textContent = "Número de telefone, palavra-passe ou perfil incorreto.";
            return;
        }

        const approvalStatus = String(
            loginAccount.approvalStatus ||
            loginAccount.accountStatus ||
            (loginAccount.official ? "approved" : "approved")
        ).toLowerCase();

        if (["pending", "pending_approval", "awaiting"].includes(approvalStatus)) {
            message.textContent = "A sua conta está pendente de aprovação pela Direção. Aguarde a avaliação antes de entrar.";
            return;
        }

        if (["rejected", "blocked", "suspended"].includes(approvalStatus)) {
            message.textContent = loginAccount.approvalReason
                ? "A sua conta não foi aprovada: " + loginAccount.approvalReason
                : "A sua conta não foi aprovada pela Direção.";
            return;
        }

        try {
            if (window.apsanCloud) {
                const authUser = await window.apsanCloud.signIn(loginAccount);
                loginAccount = Object.assign({}, loginAccount, {
                    authUid: authUser && authUser.uid ? authUser.uid : "",
                    authEmail: window.apsanCloud.authEmail(loginAccount)
                });
                await window.apsanCloud.saveAccount(loginAccount);
            }
        } catch (firebaseError) {
            /* A conta antiga continua válida no primeiro acesso se ainda estiver no navegador. */
            if (!localAccount || localAccount.password !== password) {
                message.textContent = "Não foi possível autenticar esta conta online. Verifique a palavra-passe e tente novamente.";
                return;
            }
        }

        localStorage.setItem("apsan_account", JSON.stringify(loginAccount));
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
    const adminAccessTrigger = document.getElementById("adminAccessTrigger");
    const adminAccessModal = document.getElementById("adminAccessModal");
    const adminAccessClose = document.getElementById("adminAccessClose");
    const adminAccessForm = document.getElementById("adminAccessForm");
    const adminAccessMessage = document.getElementById("adminAccessMessage");

    if (adminAccessTrigger && adminAccessModal) {
        adminAccessTrigger.addEventListener("click", function () { adminAccessModal.classList.add("open"); adminAccessModal.setAttribute("aria-hidden", "false"); setTimeout(function(){ document.getElementById("adminAccessEmail")?.focus(); },50); });
        adminAccessClose?.addEventListener("click", function () { adminAccessModal.classList.remove("open"); adminAccessModal.setAttribute("aria-hidden", "true"); });
        adminAccessModal.addEventListener("click", function (event) { if(event.target===adminAccessModal){adminAccessModal.classList.remove("open");adminAccessModal.setAttribute("aria-hidden","true");} });
    }

    adminAccessForm?.addEventListener("submit", async function(event){
        event.preventDefault();
        const email=document.getElementById("adminAccessEmail")?.value.trim().toLowerCase()||"";
        const password=document.getElementById("adminAccessPassword")?.value.trim()||"";
        if(adminAccessMessage){adminAccessMessage.style.color="#d93025";adminAccessMessage.textContent="";}
        if(email!=="suporte@apsanlda.com" || password!=="12suporte45"){if(adminAccessMessage)adminAccessMessage.textContent="Credenciais da Administração incorretas.";return;}
        const directionAccount={id:"direction_support",name:"Direção APSAN Academy",email:"suporte@apsanlda.com",phone:"suporte@apsanlda.com",type:"direcao",password:password};
        if(adminAccessMessage){adminAccessMessage.style.color="#1769e0";adminAccessMessage.textContent="A verificar acesso...";}
        try{
            if(!window.apsanCloud) throw new Error("cloud");
            const authUser=await window.apsanCloud.signIn(directionAccount,{allowCreate:false});
            let profile={};try{profile=JSON.parse(localStorage.getItem("apsan_direction_profile")||"{}")||{};}catch(_){ }
            const session=Object.assign({},directionAccount,{name:profile.name||"Direção APSAN Academy",photo:profile.logo||"",nif:profile.nif||"",location:profile.location||"",authUid:authUser&&authUser.uid?authUser.uid:"",authEmail:"suporte@apsanlda.com"});
            localStorage.setItem("apsan_account",JSON.stringify(session));localStorage.setItem("apsan_phone","suporte@apsanlda.com");localStorage.setItem("apsan_user_type","direcao");localStorage.setItem("apsan_logged_in","true");
            window.location.replace("Style/Apps/direcao-final.html?direction=final-20260927-01");
        }catch(_){if(adminAccessMessage){adminAccessMessage.style.color="#d93025";adminAccessMessage.textContent="Não foi possível validar a conta administrativa existente.";}}
    });

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


    /*
     * Navegação do professor:
     * o dashboard inicial mostra somente o cabeçalho/hero e o ambiente
     * visual. Cada módulo abre isoladamente quando escolhido no menu.
     * A navegação inferior acompanha sempre o módulo atualmente aberto.
     */
    function syncProfessorBottomNav(targetId) {
        if (!document.body.classList.contains("professor-page")) return;

        const bottomNav = document.querySelector(".professor-bottom-nav");
        if (!bottomNav) return;

        bottomNav.querySelectorAll("a").forEach(function (link) {
            const href = link.getAttribute("href") || "";
            const linkTarget = href.charAt(0) === "#" ? href.slice(1) : "";
            const isHome =
                !targetId &&
                (
                    href === "professor.html" ||
                    href === "./professor.html" ||
                    href.endsWith("/professor.html")
                );

            link.classList.toggle(
                "active",
                targetId ? linkTarget === targetId : isHome
            );
        });
    }

    function setSinglePanelView(targetId, options) {
        const isProfessor = document.body.classList.contains("professor-page");
        const isAdmin = document.body.classList.contains("admin-page");

        if (!isProfessor && !isAdmin) return false;

        const main = document.querySelector("main");
        if (!main) return false;

        const target = document.getElementById(targetId);
        const viewSections = main.querySelectorAll("[data-view-section], section[id]");

        /* Direção: o próprio main é a página inicial; os módulos do menu ficam fechados. */
        if (isAdmin && targetId === "admin-dashboard") {
            viewSections.forEach(function (section) {
                section.classList.add("single-panel-hidden");
                section.classList.remove("menu-focus-active");
            });
            main.classList.remove("single-panel-mode");
            window.scrollTo({ top: 0, behavior: "smooth" });
            if (!(options && options.keepHash)) {
                window.history.replaceState(null, "", window.location.pathname);
            }
            return true;
        }

        if (!target) return false;

        viewSections.forEach(function (section) {
            section.classList.toggle("single-panel-hidden", section !== target);
            if (section !== target) {
                section.classList.remove("menu-focus-active");
            }
        });

        main.classList.add("single-panel-mode");
        target.classList.remove("single-panel-hidden");
        target.classList.add("menu-focus-active");

        if (isProfessor) {
            syncProfessorBottomNav(targetId);
        }

        window.scrollTo({ top: 0, behavior: "smooth" });

        if (!(options && options.keepHash)) {
            window.history.replaceState(null, "", "#" + targetId);
        }

        return true;
    }

    function openProfessorOrAdminView(targetId, options) {
        return setSinglePanelView(targetId, options);
    }

    menuLinks.forEach(function (link) {
        link.addEventListener("click", function (event) {
            const href = link.getAttribute("href") || "";
            const targetId = href.charAt(0) === "#" ? href.slice(1) : "";

            if (sideMenu) sideMenu.classList.remove("menu-open");

            if (targetId) {
                if (openProfessorOrAdminView(targetId)) {
                    event.preventDefault();

                    document.querySelectorAll("[data-menu-focus]").forEach(function (item) {
                        item.classList.remove("menu-focus-active");
                    });

                    const target = document.getElementById(targetId);
                    if (target) target.classList.add("menu-focus-active");
                }
            }
        });
    });

    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
        link.addEventListener("click", function (event) {
            const targetId = (link.getAttribute("href") || "").slice(1);
            if (!targetId) return;

            if (openProfessorOrAdminView(targetId)) {
                event.preventDefault();
                if (sideMenu) sideMenu.classList.remove("menu-open");
            }
        });
    });

    function restoreSinglePanelViewFromHash() {
        const hash = window.location.hash ? window.location.hash.slice(1) : "";

        if (hash && document.getElementById(hash)) {
            if (openProfessorOrAdminView(hash, { keepHash: true })) return;
        }

        if (document.body.classList.contains("professor-page")) {
            const sections = document.querySelectorAll(".professor-view-section");
            sections.forEach(function (section) {
                /*
                 * A página inicial contém somente os elementos visuais do
                 * dashboard. Todos os módulos do menu continuam fechados.
                 * Assim, o cartão de boas-vindas e o ambiente tecnológico
                 * permanecem visíveis juntos, como no visual definido.
                 */
                const isHomeSection =
                    section.getAttribute("data-view-section") === "home";

                section.classList.toggle(
                    "single-panel-hidden",
                    !isHomeSection
                );
                section.classList.remove("menu-focus-active");
            });

            const dashboardMain = document.querySelector("main");
            if (dashboardMain) dashboardMain.classList.remove("single-panel-mode");

            syncProfessorBottomNav("");
            window.scrollTo({ top: 0, behavior: "smooth" });
        } else if (document.body.classList.contains("admin-page")) {
            setSinglePanelView("admin-dashboard", { keepHash: true });
        }
    }
    restoreSinglePanelViewFromHash();



    /* =====================================================
       DADOS DA CONTA
       ===================================================== */

    let account = null;
    let pendingProfilePhoto = null;

    account = resolveCurrentAccount();


    /* =====================================================
       PROTEÇÃO POR PERFIL
       ===================================================== */

    function accountIsOfficial(current) {
        if (!current) return false;
        const status = String(
            current.approvalStatus ||
            current.accountStatus ||
            (current.official === true ? "approved" : "approved")
        ).toLowerCase();
        return !["pending", "pending_approval", "awaiting", "rejected", "blocked", "suspended"].includes(status);
    }

    if (
        account &&
        (account.type === "professor" || account.type === "aluno") &&
        !accountIsOfficial(account)
    ) {
        localStorage.removeItem("apsan_logged_in");
        window.location.href = "../../index.html";
        return;
    }

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
       NOTIFICAÇÕES DE MENSAGENS
       ===================================================== */

    function readMessageNotifications() {
        try {
            const items = JSON.parse(localStorage.getItem("apsan_message_notifications") || "[]");
            return Array.isArray(items) ? items : [];
        } catch (error) {
            return [];
        }
    }

    function normalizeMessagePhone(value) {
        const digits = String(value || "").replace(/\D/g, "");
        return digits.length > 9 ? digits.slice(-9) : digits;
    }

    function updateProfessorMessageNotifications() {
        if (!account || account.type !== "professor") return;

        const phone = normalizeMessagePhone(account.phone);
        const unread = readMessageNotifications().filter(function (item) {
            return normalizeMessagePhone(item.recipientPhone) === phone && !item.readAt;
        });
        const count = unread.length;

        const menuBadge = document.getElementById("professorMessageMenuBadge");
        const messageCount = document.getElementById("messageCount");
        const messageBadge = document.getElementById("messageBadge");
        const messagesContent = document.getElementById("messagesContent");

        if (menuBadge) {
            menuBadge.textContent = count;
            menuBadge.hidden = count === 0;
        }
        if (messageCount) messageCount.textContent = count;
        if (messageBadge) messageBadge.textContent = count;

        if (messagesContent) {
            if (!count) {
                messagesContent.innerHTML = '<p class="empty-state">Você ainda não tem mensagens novas.</p>';
            } else {
                const latest = unread.slice().sort(function (a, b) {
                    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
                })[0];
                messagesContent.innerHTML =
                    '<div class="module-row message-notification-row">' +
                        '<span class="module-row-icon">💬</span>' +
                        '<div><strong>' + escapeModuleText(latest.senderName || "Novo remetente") + '</strong>' +
                        '<small>' + count + (count === 1 ? ' nova mensagem' : ' novas mensagens') + '</small>' +
                        (latest.textPreview ? '<p>' + escapeModuleText(latest.textPreview) + '</p>' : '') +
                        '</div>' +
                    '</div>';
            }
        }
    }

    const openMessagesButton = document.getElementById("openMessagesButton");
    if (openMessagesButton) {
        openMessagesButton.addEventListener("click", function () {
            window.location.href = "mensagens.html";
        });
    }

    window.addEventListener("storage", function (event) {
        if (event.key === "apsan_message_notifications") {
            updateProfessorMessageNotifications();
        }
    });

    updateProfessorMessageNotifications();
    setInterval(updateProfessorMessageNotifications, 2000);

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
       DADOS VISUAIS DO PERFIL DO PROFESSOR
       ===================================================== */

    function getStoredProfessorProfileData() {
        const data = {
            name: "",
            photo: ""
        };

        if (account) {
            data.name =
                account.name ||
                account.teacherName ||
                "";

            data.photo =
                account.photo ||
                account.profilePhoto ||
                account.avatar ||
                account.teacherPhoto ||
                account.photoURL ||
                "";
        }

        /*
         * Compatibilidade com perfis antigos: procura a informação guardada
         * com o telefone original, telefone normalizado ou username.
         */
        try {
            const phone = account && account.phone ? String(account.phone) : "";
            const username = account && account.username ? String(account.username) : "";
            const keys = [];

            if (phone) keys.push("apsan_professor_profile_" + phone);
            if (phone) keys.push("apsan_professor_profile_" + normalizePhone(phone));
            if (username) keys.push("apsan_professor_profile_" + username);

            keys.forEach(function (key) {
                const raw = localStorage.getItem(key);
                if (!raw) return;

                let profile = null;
                try {
                    profile = JSON.parse(raw);
                } catch (error) {
                    return;
                }

                if (!profile) return;

                if (!data.name || data.name === "Professor") {
                    data.name =
                        profile.teacherName ||
                        profile.name ||
                        data.name;
                }

                if (!data.photo) {
                    data.photo =
                        profile.teacherPhoto ||
                        profile.photo ||
                        profile.profilePhoto ||
                        profile.avatar ||
                        profile.photoURL ||
                        "";
                }
            });
        } catch (error) {
            /* mantém os dados da conta */
        }

        return data;
    }
    /* =====================================================
       MOSTRAR DADOS NO PAINEL
       ===================================================== */

    function updateProfileDisplay() {

        if (!account) {
            return;
        }

        const storedProfile = getStoredProfessorProfileData();

        const professorDisplayName =
            storedProfile.name && String(storedProfile.name).trim() &&
            String(storedProfile.name).trim().toLowerCase() !== "professor"
                ? String(storedProfile.name).trim()
                : "Eduardo Ngongoyove Gabriel";

        if (teacherName) {
            teacherName.textContent = professorDisplayName;
        }

        const signatureName = document.getElementById("dashboardProfessorSignature");
        if (signatureName) {
            signatureName.textContent = professorDisplayName;
        }

        const photo = storedProfile.photo;

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
                    (storedProfile.name || account.name || "P").charAt(0).toUpperCase();
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

        const profileProvince = document.getElementById("profileProvince");
        const profileCountry = document.getElementById("profileCountry");


        const profilePhotoPreview =
            document.getElementById(
                "profilePhotoPreview"
            );


        const profilePhotoLetter =
            document.getElementById(
                "profilePhotoLetter"
            );


        const storedProfile = getStoredProfessorProfileData();
        pendingProfilePhoto = storedProfile.photo || null;

        if (account) {

            profileName.value =
                storedProfile.name || "Eduardo Ngongoyove Gabriel";


            if (profileUsername) {
                profileUsername.value =
                    account.username || "";
            }

            if (profileBio) {
                profileBio.value = account.bio || "";
            }
            if (profileProvince) {
                profileProvince.value = account.province || "";
            }
            if (profileCountry) {
                profileCountry.value = account.country || "";
            }


            profilePassword.value =
                "";


            if (storedProfile.photo) {

                profilePhotoPreview.src =
                    storedProfile.photo;

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
                const profileBioValue = document.getElementById("profileBio") ? document.getElementById("profileBio").value.trim() : "";
                const profileProvinceValue = document.getElementById("profileProvince") ? document.getElementById("profileProvince").value.trim() : "";
                const profileCountryValue = document.getElementById("profileCountry") ? document.getElementById("profileCountry").value.trim() : "";

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
                updatedAccount.bio = profileBioValue;
                updatedAccount.province = profileProvinceValue;
                updatedAccount.country = profileCountryValue;

                /*
                 * Sempre grava a foto final no campo principal "photo".
                 * Isto sincroniza fotos antigas e novas com o avatar.
                 */
                const finalPhoto =
                    pendingProfilePhoto ||
                    getStoredProfessorProfileData().photo ||
                    "";

                if (finalPhoto) {
                    updatedAccount.photo = finalPhoto;
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
                    pendingProfilePhoto = account.photo || getStoredProfessorProfileData().photo || null;

                    const currentPublicProfile = getPublicProfile();

                    if (currentPublicProfile.published) {
                        currentPublicProfile.teacherName = account.name || "Professor";
                        currentPublicProfile.teacherPhoto =
                            account.photo ||
                            getStoredProfessorProfileData().photo ||
                            "";
                        currentPublicProfile.bio = account.bio || "";
                        currentPublicProfile.province = account.province || "";
                        currentPublicProfile.country = account.country || "";
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
            publicBio: profile.bio || (account && account.bio) || "",
            publicProvince: profile.province || (account && account.province) || "",
            publicCountry: profile.country || (account && account.country) || "",
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
                bio: document.getElementById("publicBio").value.trim(),
                province: document.getElementById("publicProvince").value.trim(),
                country: document.getElementById("publicCountry").value.trim(),
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
        (account && account.phone) ||
        localStorage.getItem("apsan_phone") ||
        "default";

    const professorPhoneNormalized = normalizePhone(professorPhone);

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
                    normalizePhone(student.teacherPhone) === professorPhoneNormalized &&
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
                let studentAccounts = [];
                try {
                    const storedAccounts = JSON.parse(localStorage.getItem("apsan_accounts") || "[]");
                    studentAccounts = Array.isArray(storedAccounts) ? storedAccounts : [];
                } catch (error) {
                    studentAccounts = [];
                }

                function findStudentAccount(phone) {
                    const normalized = normalizePhone(phone);
                    return studentAccounts.find(function (account) {
                        return account &&
                            account.type === "aluno" &&
                            normalizePhone(account.phone) === normalized;
                    }) || null;
                }

                const official = enrollments
                    .filter(function (item) {
                        return (
                            item &&
                            normalizePhone(item.teacherPhone) === professorPhoneNormalized &&
                            item.status === "official"
                        );
                    })
                    .map(function (item) {
                        return {
                            id: item.id,
                            name: item.studentName,
                            studentName: item.studentName,
                            studentPhone: item.studentPhone,
                            teacherPhone: item.teacherPhone,
                            course: item.course || item.courseName || "Curso em acompanhamento",
                            courseName: item.courseName || item.course || "Curso em acompanhamento",
                            photo: (findStudentAccount(item.studentPhone) || {}).photo || (findStudentAccount(item.studentPhone) || {}).profilePhoto || "",
                            profilePhoto: (findStudentAccount(item.studentPhone) || {}).profilePhoto || (findStudentAccount(item.studentPhone) || {}).photo || "",
                            bio: (findStudentAccount(item.studentPhone) || {}).bio || "",
                            province: (findStudentAccount(item.studentPhone) || {}).province || "",
                            country: (findStudentAccount(item.studentPhone) || {}).country || "",
                            status: "official"
                        };
                    });

                const combined = students.concat(official);
                const seen = {};
                students = combined.reduce(function (result, item) {
                    const phoneKey = String(item.studentPhone || item.phone || "").replace(/\D/g, "");
                    const nameKey = String(item.studentName || item.name || "").trim().toLowerCase().replace(/\s+/g, " ");
                    const key = phoneKey ? "phone:" + phoneKey : (nameKey ? "name:" + nameKey : "id:" + String(item.id || ""));

                    const account = findStudentAccount(item.studentPhone || item.phone);
                    const accountPhoto = account
                        ? (account.photo || account.profilePhoto || account.avatar || "")
                        : "";

                    if (seen[key]) {
                        const existing = seen[key];
                        existing.photo = existing.photo || existing.profilePhoto || accountPhoto;
                        existing.profilePhoto = existing.profilePhoto || existing.photo || accountPhoto;
                        existing.name = existing.name || item.name || item.studentName;
                        existing.course = existing.course || item.course || item.courseName;
                        if (account) {
                            existing.bio = account.bio || existing.bio || "";
                            existing.province = account.province || existing.province || "";
                            existing.country = account.country || existing.country || "";
                        }
                        return result;
                    }

                    const mergedItem = Object.assign({}, item);
                    if (accountPhoto) {
                        mergedItem.photo = mergedItem.photo || mergedItem.profilePhoto || accountPhoto;
                        mergedItem.profilePhoto = mergedItem.profilePhoto || mergedItem.photo || accountPhoto;
                    }
                    if (account) {
                        mergedItem.bio = account.bio || mergedItem.bio || "";
                        mergedItem.province = account.province || mergedItem.province || "";
                        mergedItem.country = account.country || mergedItem.country || "";
                    }
                    seen[key] = mergedItem;
                    result.push(mergedItem);
                    return result;
                }, []);
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
        const studentOverviewTotal = document.getElementById("studentOverviewTotal");
        const studentOverviewActive = document.getElementById("studentOverviewActive");
        const studentOverviewUpcoming = document.getElementById("studentOverviewUpcoming");
        const studentUpcomingPanel = document.getElementById("studentUpcomingPanel");
        const studentUpcomingList = document.getElementById("studentUpcomingList");

        if (studentOverviewTotal) studentOverviewTotal.textContent = students.length;

        const activeStudents = students.filter(function (student) {
            return String(student.status || "active").toLowerCase() !== "inactive";
        });

        if (studentOverviewActive) studentOverviewActive.textContent = activeStudents.length;
        if (studentOverviewUpcoming) studentOverviewUpcoming.textContent = lessons.length;

        if (studentsList) {
            if (!students.length) {
                studentsList.innerHTML =
                    '<p class="empty-state">Os alunos oficiais aparecerão aqui após a matrícula e confirmação pela direção.</p>';
            } else {
                const upcomingLesson = lessons
                    .slice()
                    .sort(function (a, b) {
                        return (String(a.date || "") + String(a.time || "")).localeCompare(String(b.date || "") + String(b.time || ""));
                    })[0];

                studentsList.innerHTML = students.map(function (student) {
                    const name = student.name || student.studentName || "Aluno";
                    const course = student.course || student.courseName || "Curso em acompanhamento";
                    const inactive = String(student.status || "active").toLowerCase() === "inactive";
                    const statusLabel = inactive ? "Inativo" : "Ativo";
                    const nextInfo = upcomingLesson
                        ? "Próxima aula: " + formatLessonDate(upcomingLesson.date) + " · " + upcomingLesson.time
                        : "Sem próxima aula agendada";

                    return '<div class="professor-student-row" data-student-name="' + escapeModuleAttribute(name) + '" data-student-course="' + escapeModuleAttribute(course) + '" data-student-status="' + (inactive ? "inactive" : "active") + '">' +
                        '<span class="module-row-icon student-list-photo" data-student-photo="' + escapeModuleAttribute(student.photo || student.profilePhoto || "") + '">' +
                            ((student.photo || student.profilePhoto) ? '<img src="' + escapeModuleAttribute(student.photo || student.profilePhoto) + '" alt="Foto de ' + escapeModuleAttribute(name) + '">' : '👤') +
                        '</span>' +
                        '<div><strong>' + escapeModuleText(name) + '</strong>' +
                        '<small>🟢 ' + escapeModuleText(statusLabel) + ' · ' + escapeModuleText(course) + '</small>' +
                        '<small>' + escapeModuleText(nextInfo) + '</small></div>' +
                        '<span class="professor-student-status' + (inactive ? ' inactive' : '') + '">' + escapeModuleText(statusLabel) + '</span>' +
                        '<button type="button" class="student-view-button" data-view-student-name="' + escapeModuleAttribute(name) + '" data-view-student-course="' + escapeModuleAttribute(course) + '" data-view-student-status="' + (inactive ? "inactive" : "active") + '" data-view-student-photo="' + escapeModuleAttribute(student.photo || student.profilePhoto || "") + '" data-view-student-bio="' + escapeModuleAttribute(student.bio || "") + '" data-view-student-province="' + escapeModuleAttribute(student.province || "") + '" data-view-student-country="' + escapeModuleAttribute(student.country || "") + '">Ver aluno</button>' +
                        '</div>';
                }).join("");
            }
        }

        if (studentUpcomingPanel && studentUpcomingList) {
            const upcomingLessons = lessons
                .slice()
                .sort(function (a, b) {
                    return (String(a.date || "") + String(a.time || "")).localeCompare(String(b.date || "") + String(b.time || ""));
                })
                .slice(0, 3);

            if (upcomingLessons.length) {
                studentUpcomingPanel.hidden = false;
                studentUpcomingList.innerHTML = upcomingLessons.map(function (lesson) {
                    const title = lesson.title || lesson.course || "Aula";
                    const date = formatLessonDate(lesson.date);
                    const time = lesson.time || "--:--";
                    return '<div class="professor-upcoming-row">' +
                        '<span class="professor-upcoming-date">' + escapeModuleText(date) + '<br>' + escapeModuleText(time) + '</span>' +
                        '<div><strong>' + escapeModuleText(title) + '</strong><small>' + escapeModuleText(lesson.course || "Curso em acompanhamento") + '</small></div>' +
                        '</div>';
                }).join("");
            } else {
                studentUpcomingPanel.hidden = true;
                studentUpcomingList.innerHTML = "";
            }
        }


        const materialsList = document.getElementById("materialsList");

        if (materialsList) {
            if (!materials.length) {
                materialsList.innerHTML =
                    '<p class="empty-state">Ainda não existem materiais guardados.</p>';
            } else {
                materialsList.innerHTML = materials.map(function (material) {
                    const resource = material.link || material.fileData || "";
                    const link = resource
                        ? '<a href="' + escapeModuleAttribute(resource) + '" target="_blank" rel="noopener">Abrir</a>'
                        : "";
                    const lesson = material.lessonId
                        ? lessons.find(function (lessonItem) { return String(lessonItem.id) === String(material.lessonId); })
                        : null;
                    const lessonInfo = lesson ? ' · ' + (lesson.title || "Aula") : "";
                    return '<div class="module-row">' +
                        (material.coverData
                            ? '<span class="module-row-cover"><img src="' + escapeModuleAttribute(material.coverData) + '" alt="Capa de ' + escapeModuleAttribute(material.title) + '"></span>'
                            : '<span class="module-row-icon">📄</span>') +
                        '<div><strong>' + escapeModuleText(material.title) + '</strong>' +
                        '<small>' + escapeModuleText(material.type || "Material") + ' · ' +
                        escapeModuleText(material.course || "Curso") + escapeModuleText(lessonInfo) + '</small>' +
                        (material.fileName ? '<small>📎 ' + escapeModuleText(material.fileName) + '</small>' : '') +
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
                            '<div class="schedule-actions">' +
                            (lesson.liveActive && lesson.liveId
                                ? '<button type="button" class="primary-action live-class-button" data-open-live="' + escapeModuleAttribute(lesson.liveId) + '">🔴 Entrar no quadro</button>'
                                : '<button type="button" class="primary-action live-class-button" data-start-live="' + escapeModuleAttribute(lesson.id) + '">▶ Iniciar aula</button>') +
                            '<button type="button" class="module-delete" data-delete-lesson="' + lesson.id + '">Excluir</button>' +
                            '</div>' +
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

    function getOfficialStudentsForLiveClass() {
        let enrollments = [], accounts = [];
        try { enrollments = JSON.parse(localStorage.getItem("apsan_enrollments") || "[]"); } catch (_) {}
        try { accounts = JSON.parse(localStorage.getItem("apsan_accounts") || "[]"); } catch (_) {}
        if (!Array.isArray(enrollments)) enrollments = [];
        if (!Array.isArray(accounts)) accounts = [];
        return enrollments.filter(function (item) {
            return item && normalizePhone(item.teacherPhone) === professorPhoneNormalized && item.status === "official";
        }).map(function (item) {
            const acc = accounts.find(function (a) {
                return a && a.type === "aluno" && normalizePhone(a.phone) === normalizePhone(item.studentPhone);
            }) || {};
            return {phone:normalizePhone(item.studentPhone),name:item.studentName || acc.name || "Aluno",course:item.course || item.courseName || "Curso"};
        }).filter(function (item,index,list) {
            return item.phone && list.findIndex(function (other) { return other.phone === item.phone; }) === index;
        });
    }

    function startLiveClass(lessonId) {
        const lessons = getStoredList(lessonsKey);
        const lesson = lessons.find(function (item) { return String(item.id) === String(lessonId); });
        const message = document.getElementById("lessonMessage");
        if (!lesson) return;
        const students = getOfficialStudentsForLiveClass();
        if (!students.length) {
            if (message) { message.textContent = "Não existem alunos oficiais confirmados para esta aula."; message.style.color = "#d93025"; }
            return;
        }
        let liveClasses = [], notifications = [];
        try { liveClasses = JSON.parse(localStorage.getItem("apsan_live_classes") || "[]"); } catch (_) {}
        try { notifications = JSON.parse(localStorage.getItem("apsan_header_notifications") || "[]"); } catch (_) {}
        if (!Array.isArray(liveClasses)) liveClasses = [];
        if (!Array.isArray(notifications)) notifications = [];
        const liveId = "live_" + Date.now() + "_" + Math.random().toString(36).slice(2,8);
        const live = {
            id:liveId, lessonId:String(lesson.id), title:lesson.title || "Aula ao vivo",
            course:lesson.course || "Curso", description:lesson.description || "",
            teacherPhone:professorPhoneNormalized,
            teacherName:(account && account.name) || localStorage.getItem("apsan_username") || "Professor",
            students:students.map(function (s) { return s.phone; }),
            startedAt:new Date().toISOString(), active:true
        };
        liveClasses.push(live);
        localStorage.setItem("apsan_live_classes", JSON.stringify(liveClasses.slice(-30)));
        students.forEach(function (student) {
            const recipientKey = "aluno:" + student.phone;
            notifications.push({
                id:"hn_live_" + Date.now() + "_" + Math.random().toString(36).slice(2,8),
                recipientKey:recipientKey, recipientType:"aluno",
                title:"🔴 Aula ao vivo iniciada",
                text:live.teacherName + " iniciou a aula \"" + live.title + "\". Toque aqui para entrar na aula.",
                kind:"live-class", liveId:liveId,
                link:"quadro.html?live=" + encodeURIComponent(liveId),
                createdAt:new Date().toISOString(), readAt:null
            });
        });
        localStorage.setItem("apsan_header_notifications", JSON.stringify(notifications.slice(-200)));
        lesson.liveId = liveId; lesson.liveStartedAt = live.startedAt; lesson.liveActive = true;
        saveStoredList(lessonsKey, lessons);
        renderProfessorModules();
        window.location.href = "quadro.html?live=" + encodeURIComponent(liveId);
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

    const agendaLiveList = document.getElementById("agendaList");
    if (agendaLiveList) {
        agendaLiveList.addEventListener("click", function (event) {
            const startButton = event.target.closest("[data-start-live]");
            if (startButton) { startLiveClass(startButton.getAttribute("data-start-live")); return; }
            const openButton = event.target.closest("[data-open-live]");
            if (openButton) window.location.href = "quadro.html?live=" + encodeURIComponent(openButton.getAttribute("data-open-live"));
        });
    }

    const materialForm = document.getElementById("materialForm");
    const materialFile = document.getElementById("materialFile");
    const materialFileName = document.getElementById("materialFileName");
    const materialCover = document.getElementById("materialCover");
    const materialCoverName = document.getElementById("materialCoverName");
    const materialCoverPreview = document.getElementById("materialCoverPreview");
    const materialCourse = document.getElementById("materialCourse");
    const materialLesson = document.getElementById("materialLesson");
    let pendingMaterialFile = null;
    let pendingMaterialCover = null;

    function populateMaterialSelectors() {
        if (materialLesson) {
            const lessonsForProfessor = getStoredList(lessonsKey);
            materialLesson.innerHTML = '<option value="">Selecionar aula / módulo</option>' +
                lessonsForProfessor.map(function (lesson) {
                    const label = (lesson.title || "Aula") + (lesson.date ? " · " + formatLessonDate(lesson.date) : "");
                    return '<option value="' + escapeModuleAttribute(lesson.id || "") + '">' + escapeModuleText(label) + '</option>';
                }).join("");
        }
    }

    function readMaterialFile(file) {
        if (!file) return;
        if (file.size > 2500000) {
            if (materialFileName) materialFileName.textContent = "Arquivo muito grande — máximo 2,5 MB";
            if (materialFile) materialFile.value = "";
            pendingMaterialFile = null;
            return;
        }

        const reader = new FileReader();
        reader.onload = function (event) {
            pendingMaterialFile = {
                name: file.name,
                type: file.type || "application/octet-stream",
                data: event.target.result
            };
            if (materialFileName) materialFileName.textContent = file.name + " · pronto para carregar";
        };
        reader.onerror = function () {
            pendingMaterialFile = null;
            if (materialFileName) materialFileName.textContent = "Não foi possível carregar o arquivo";
        };
        reader.readAsDataURL(file);
    }

    function readMaterialCover(file) {
        if (!file) return;
        if (!String(file.type || "").startsWith("image/")) {
            if (materialCoverName) materialCoverName.textContent = "Selecione uma imagem válida";
            return;
        }

        const reader = new FileReader();
        reader.onload = function (event) {
            const img = new Image();
            img.onload = function () {
                const maxW = 1200;
                const maxH = 675;
                const scale = Math.min(1, maxW / img.width, maxH / img.height);
                const canvas = document.createElement("canvas");
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const data = canvas.toDataURL("image/jpeg", 0.82);

                pendingMaterialCover = {
                    name: file.name,
                    type: "image/jpeg",
                    data: data
                };

                if (materialCoverName) materialCoverName.textContent = file.name + " · capa pronta";
                if (materialCoverPreview) {
                    materialCoverPreview.innerHTML = '<img src="' + data + '" alt="Capa do material">';
                }
            };
            img.src = event.target.result;
        };
        reader.onerror = function () {
            pendingMaterialCover = null;
            if (materialCoverName) materialCoverName.textContent = "Não foi possível carregar a capa";
        };
        reader.readAsDataURL(file);
    }

    document.addEventListener("click", function (event) {
        const openMaterial = event.target.closest('[data-open-panel="material"]');
        if (openMaterial) populateMaterialSelectors();
    });

    if (materialFile) {
        materialFile.addEventListener("change", function () {
            readMaterialFile(materialFile.files && materialFile.files[0]);
        });
    }

    if (materialCover) {
        materialCover.addEventListener("change", function () {
            readMaterialCover(materialCover.files && materialCover.files[0]);
        });
    }

    if (materialForm) {
        materialForm.addEventListener("submit", function (event) {
            event.preventDefault();

            const title = document.getElementById("materialTitle").value.trim();
            const type = document.getElementById("materialType").value;
            const link = document.getElementById("materialLink").value.trim();
            const course = materialCourse ? materialCourse.value.trim() : "";
            const lessonId = materialLesson ? materialLesson.value : "";
            const description = document.getElementById("materialDescription")
                ? document.getElementById("materialDescription").value.trim()
                : "";
            const message = document.getElementById("materialMessage");

            if (!title) {
                message.textContent = "Digite o título do material.";
                message.style.color = "#d93025";
                return;
            }

            if (!course) {
                message.textContent = "Digite o nome do curso ou disciplina.";
                message.style.color = "#d93025";
                return;
            }

            if (!link && !pendingMaterialFile) {
                message.textContent = "Selecione um arquivo ou cole um link.";
                message.style.color = "#d93025";
                return;
            }

            const materials = getStoredList(materialsKey);

            materials.push({
                id: Date.now().toString(),
                title: title,
                type: type,
                link: link,
                fileName: pendingMaterialFile ? pendingMaterialFile.name : "",
                fileData: pendingMaterialFile ? pendingMaterialFile.data : "",
                description: description,
                course: course,
                lessonId: lessonId,
                coverName: pendingMaterialCover ? pendingMaterialCover.name : "",
                coverData: pendingMaterialCover ? pendingMaterialCover.data : "",
                teacherPhone: professorPhone,
                published: true,
                createdAt: new Date().toISOString()
            });

            try {
                saveStoredList(materialsKey, materials);
            } catch (storageError) {
                message.textContent = "Não foi possível guardar este arquivo. Tente um arquivo menor.";
                message.style.color = "#d93025";
                return;
            }

            renderProfessorModules();

            message.textContent = "Material guardado e disponibilizado.";
            message.style.color = "#16803c";

            materialForm.reset();
            pendingMaterialFile = null;
            pendingMaterialCover = null;
            if (materialFileName) materialFileName.textContent = "Nenhum arquivo selecionado";
            if (materialCoverName) materialCoverName.textContent = "Nenhuma capa selecionada";
            if (materialCoverPreview) materialCoverPreview.innerHTML = "<span>🖼️</span>";
            populateMaterialSelectors();

            setTimeout(function () {
                document.getElementById("materialPanel").classList.remove("professor-panel-open");
                message.textContent = "";
            }, 700);
        });
    }

    document.addEventListener("click", function (event) {
        const openMaterial = event.target.closest('[data-open-panel="material"]');
        if (openMaterial) {
            populateMaterialSelectors();
        }
    });

    if (materialFile) {
        materialFile.addEventListener("change", function () {
            const file = materialFile.files && materialFile.files[0];
            pendingMaterialFile = null;
            if (!file) {
                if (materialFileName) materialFileName.textContent = "Nenhum arquivo selecionado";
                return;
            }

            if (file.size > 2500000) {
                if (materialFileName) materialFileName.textContent = "Arquivo muito grande (máx. 2,5 MB)";
                materialFile.value = "";
                return;
            }

            const reader = new FileReader();
            reader.onload = function (event) {
                pendingMaterialFile = {
                    name: file.name,
                    type: file.type || "application/octet-stream",
                    data: event.target.result
                };
                if (materialFileName) materialFileName.textContent = file.name;
            };
            reader.readAsDataURL(file);
        });
    }

    if (materialForm) {
        materialForm.addEventListener("submit", function (event) {
            event.preventDefault();

            const title = document.getElementById("materialTitle").value.trim();
            const type = document.getElementById("materialType").value;
            const link = document.getElementById("materialLink").value.trim();
            const description = document.getElementById("materialDescription")
                ? document.getElementById("materialDescription").value.trim()
                : "";
            const course = materialCourse && materialCourse.value
                ? materialCourse.value
                : "Curso do professor";
            const lessonId = materialLesson ? materialLesson.value : "";
            const message = document.getElementById("materialMessage");

            if (!title) {
                message.textContent = "Digite o título do material.";
                message.style.color = "#d93025";
                return;
            }

            if (!link && !pendingMaterialFile) {
                message.textContent = "Selecione um arquivo ou cole um link.";
                message.style.color = "#d93025";
                return;
            }

            const materials = getStoredList(materialsKey);

            materials.push({
                id: Date.now().toString(),
                title: title,
                type: type,
                link: link,
                fileName: pendingMaterialFile ? pendingMaterialFile.name : "",
                fileData: pendingMaterialFile ? pendingMaterialFile.data : "",
                description: description,
                course: course,
                lessonId: lessonId,
                teacherPhone: professorPhone,
                published: true,
                createdAt: new Date().toISOString()
            });

            saveStoredList(materialsKey, materials);
            renderProfessorModules();

            message.textContent = "Material guardado e disponibilizado.";
            message.style.color = "#16803c";

            materialForm.reset();
            pendingMaterialFile = null;
            if (materialFileName) materialFileName.textContent = "Nenhum arquivo selecionado";
            populateMaterialSelectors();

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

    function openStudentView(button) {
        const panel = document.getElementById("studentViewPanel");
        if (!panel) return;

        const name = button.getAttribute("data-view-student-name") || "Aluno";
        const course = button.getAttribute("data-view-student-course") || "Curso em acompanhamento";
        const bio = button.getAttribute("data-view-student-bio") || "";
        const province = button.getAttribute("data-view-student-province") || "";
        const country = button.getAttribute("data-view-student-country") || "";
        const status = button.getAttribute("data-view-student-status") || "active";
        const photo = button.getAttribute("data-view-student-photo") || "";

        const nameEl = document.getElementById("studentViewName");
        const bioEl = document.getElementById("studentViewBio");
        const locationEl = document.getElementById("studentViewLocation");
        const courseEl = document.getElementById("studentViewCourse");
        const statusEl = document.getElementById("studentViewStatus");
        const photoEl = document.getElementById("studentViewPhoto");
        const letterEl = document.getElementById("studentViewLetter");

        if (nameEl) nameEl.textContent = name;
        if (bioEl) bioEl.textContent = bio || "Bio não definida.";
        if (locationEl) locationEl.textContent = [province, country].filter(Boolean).join(" · ") || "Localização não definida.";
        if (courseEl) courseEl.textContent = course;
        if (statusEl) statusEl.textContent = status === "inactive" ? "⚪ Aluno inativo" : "🟢 Aluno ativo";

        const upcoming = getStoredList(lessonsKey).slice().sort(function(a,b){
            return (String(a.date||"")+String(a.time||"")).localeCompare(String(b.date||"")+String(b.time||""));
        })[0];

        const nextEl = document.getElementById("studentViewNext");
        if (nextEl) nextEl.textContent = upcoming
            ? formatLessonDate(upcoming.date) + " · " + (upcoming.time || "—")
            : "Sem aula agendada";

        if (photoEl && photo) {
            photoEl.src = photo;
            photoEl.style.display = "block";
            if (letterEl) letterEl.style.display = "none";
        } else {
            if (photoEl) {
                photoEl.removeAttribute("src");
                photoEl.style.display = "none";
            }
            if (letterEl) {
                letterEl.textContent = (name.charAt(0) || "A").toUpperCase();
                letterEl.style.display = "flex";
            }
        }

        panel.classList.add("professor-panel-open");
    }

    document.addEventListener("click", function(event) {
        const viewButton = event.target.closest("[data-view-student]");
        if (viewButton) openStudentView(viewButton);

        const closeStudent = event.target.closest('[data-close-panel="studentView"]');
        if (closeStudent) {
            const panel = document.getElementById("studentViewPanel");
            if (panel) panel.classList.remove("professor-panel-open");
        }
    });

    const studentSearchInput = document.getElementById("studentSearchInput");
    let studentFilter = "all";

    function filterProfessorStudents() {
        const query = studentSearchInput ? studentSearchInput.value.trim().toLowerCase() : "";
        document.querySelectorAll("#studentsList .professor-student-row").forEach(function (row) {
            const name = (row.getAttribute("data-student-name") || "").toLowerCase();
            const course = (row.getAttribute("data-student-course") || "").toLowerCase();
            const status = row.getAttribute("data-student-status") || "active";
            const matchesQuery = !query || name.indexOf(query) !== -1 || course.indexOf(query) !== -1;
            const matchesFilter = studentFilter === "all" || status === studentFilter;
            row.style.display = matchesQuery && matchesFilter ? "" : "flex";
        });
    }

    if (studentSearchInput) {
        studentSearchInput.addEventListener("input", filterProfessorStudents);
    }

    document.querySelectorAll("[data-student-filter]").forEach(function (button) {
        button.addEventListener("click", function () {
            document.querySelectorAll("[data-student-filter]").forEach(function (item) {
                item.classList.remove("active");
            });
            button.classList.add("active");
            studentFilter = button.getAttribute("data-student-filter") || "all";
            filterProfessorStudents();
        });
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

                localStorage.removeItem(
                    "apsan_phone"
                );

                localStorage.removeItem(
                    "apsan_account"
                );

                window.location.href =
                    "../../index.html";

            }
        );

    }

});
