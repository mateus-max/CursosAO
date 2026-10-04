document.addEventListener("DOMContentLoaded", function () {
    const read = (key, fallback = []) => {
        try {
            const value = JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
            return value == null ? fallback : value;
        } catch (_) { return fallback; }
    };
    const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
    const esc = (value) => String(value ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    const formatKz = (value) => {
        const n = Number(String(value ?? 0).replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", "."));
        return (Number.isFinite(n) ? n : 0).toLocaleString("pt-AO") + " Kz";
    };

    const currentAccount = read("apsan_account", null);
    if (!currentAccount || currentAccount.type !== "direcao") {
        window.location.replace("../../index.html");
        return;
    }

    const sidebar = document.getElementById("adminSidebar");
    const menuButton = document.getElementById("adminMenuButton");
    const backdrop = document.getElementById("adminMenuBackdrop");

    function closeMenu() {
        sidebar?.classList.remove("menu-open");
        backdrop?.classList.remove("menu-open");
        menuButton?.setAttribute("aria-expanded", "false");
        sidebar?.setAttribute("aria-hidden", "true");
    }
    function openMenu() {
        sidebar?.classList.add("menu-open");
        backdrop?.classList.add("menu-open");
        menuButton?.setAttribute("aria-expanded", "true");
        sidebar?.setAttribute("aria-hidden", "false");
    }
    menuButton?.addEventListener("click", () => {
        sidebar?.classList.contains("menu-open") ? closeMenu() : openMenu();
    });
    backdrop?.addEventListener("click", closeMenu);
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeMenu(); });

    function showAdminView(viewId = "admin-dashboard-view", options = {}) {
        const target = document.getElementById(String(viewId).replace(/^#/, "")) || document.getElementById("admin-dashboard-view");
        const targetId = target?.getAttribute("data-admin-view") || "admin-dashboard-view";

        document.querySelectorAll("[data-admin-view]").forEach(section => {
            const active = section.getAttribute("data-admin-view") === targetId;
            section.hidden = !active;
            section.classList.toggle("admin-view-hidden", !active);
            section.classList.toggle("menu-focus-active", active && targetId !== "admin-dashboard-view");
        });
        document.querySelectorAll("#adminSidebar nav a").forEach(link => {
            const active = (link.getAttribute("href") || "").slice(1) === targetId;
            link.classList.toggle("active", active);
            link.setAttribute("aria-current", active ? "page" : "false");
        });
        if (!options.keepHash) history.replaceState(null, "", "#" + targetId);
        window.scrollTo({ top: 0, behavior: options.instant ? "auto" : "smooth" });
    }

    document.querySelectorAll("#adminSidebar nav a").forEach(link => {
        link.addEventListener("click", event => {
            event.preventDefault();

            if (link.hasAttribute("data-admin-profile-link")) {
                // O perfil é um modal e não uma página separada.
                // Mantemos o Painel e todas as outras áreas intactas.
                document.querySelectorAll("#adminSidebar nav a").forEach(item => {
                    item.classList.remove("active");
                    item.setAttribute("aria-current", "false");
                });
                link.classList.add("active");
                link.setAttribute("aria-current", "page");

                if (typeof loadDirectionProfileForm === "function") {
                    loadDirectionProfileForm();
                }
                document.getElementById("adminDirectionProfileModal")?.classList.add("open");
                closeMenu();
                return;
            }

            showAdminView(link.getAttribute("href").slice(1), { instant: true });
            closeMenu();
        });
    });

    function getEnrollment(id) {
        return read("apsan_enrollments", []).find(e => String(e.id) === String(id)) || null;
    }

    function updateEnrollment(id, changes) {
        const items = read("apsan_enrollments", []);
        const index = items.findIndex(e => String(e.id) === String(id));
        if (index < 0) return false;
        Object.assign(items[index], changes);
        write("apsan_enrollments", items);
        return true;
    }

    function getUserPhoto(account) {
        if (!account) return "";
        let photo = account.photo || account.profilePhoto || account.avatar || account.teacherPhoto || account.photoURL || "";
        if (photo) return String(photo);

        // Recupera também fotografias antigas do perfil do professor,
        // para não perder fotos guardadas antes da sincronização de contas.
        if (account.type === "professor") {
            const phone = String(account.phone || "").trim();
            const username = String(account.username || "").trim();
            const keys = [];
            if (phone) keys.push("apsan_professor_profile_" + phone);
            if (phone) keys.push("apsan_professor_profile_" + phone.replace(/\\D/g, ""));
            if (username) keys.push("apsan_professor_profile_" + username);
            for (const key of keys) {
                try {
                    const profile = JSON.parse(localStorage.getItem(key) || "null");
                    if (!profile) continue;
                    photo = profile.teacherPhoto || profile.photo || profile.profilePhoto || profile.avatar || profile.photoURL || "";
                    if (photo) return String(photo);
                } catch (_) {}
            }
        }
        return "";
    }

    function findAccountByPhone(phone, type) {
        const normalized = String(phone || "").replace(/\\D/g, "");
        if (!normalized) return null;
        return read("apsan_accounts", []).find(a => {
            if (type && a?.type !== type) return false;
            return String(a?.phone || "").replace(/\\D/g, "") === normalized;
        }) || null;
    }

    function userAvatarMarkup(account, label) {
        const photo = getUserPhoto(account);
        if (photo) {
            return '<div class="admin-row-avatar admin-user-avatar"><img src="' + esc(photo) + '" alt="Foto de ' + esc(label) + '"></div>';
        }
        const icon = account?.type === "professor" ? "👨‍🏫" : account?.type === "aluno" ? "👤" : account?.type === "direcao" ? "⚙️" : "👥";
        return '<div class="admin-row-icon">' + icon + '</div>';
    }

    function getUserProfileData(account) {
        const data = {
            name: account?.name || account?.fullName || "Utilizador",
            username: account?.username || "",
            phone: account?.phone || "",
            type: account?.type === "professor" ? "Professor" : account?.type === "aluno" ? "Aluno" : account?.type === "direcao" ? "Direção" : "Utilizador",
            status: account?.approvalStatus || account?.accountStatus || account?.status || "approved",
            bio: account?.bio || "",
            province: account?.province || "",
            country: account?.country || "",
            photo: getUserPhoto(account),
            createdAt: account?.createdAt || account?.registeredAt || ""
        };

        // O professor pode ter informações complementares guardadas no perfil legado.
        if (account?.type === "professor") {
            const phone = String(account.phone || "").trim();
            const username = String(account.username || "").trim();
            const keys = [];
            if (phone) keys.push("apsan_professor_profile_" + phone);
            if (phone) keys.push("apsan_professor_profile_" + phone.replace(/\\D/g, ""));
            if (username) keys.push("apsan_professor_profile_" + username);

            for (const key of keys) {
                try {
                    const profile = JSON.parse(localStorage.getItem(key) || "null");
                    if (!profile) continue;
                    data.name = profile.teacherName || profile.name || data.name;
                    data.bio = data.bio || profile.bio || "";
                    data.province = data.province || profile.province || "";
                    data.country = data.country || profile.country || "";
                    break;
                } catch (_) {}
            }
        }

        return data;
    }

    function getAccountKey(account) {
        return String(account?.id || account?.phone || account?.username || account?.name || "");
    }

    function getAccountApprovalState(account) {
        const value = String(account?.approvalStatus || account?.accountStatus || account?.status || "").toLowerCase();
        if (["pending", "pending_approval", "awaiting"].includes(value)) return "pending";
        if (["rejected", "blocked", "suspended"].includes(value)) return "rejected";
        return "approved";
    }

    async function setAccountDecision(key, decision) {
        const accounts = read("apsan_accounts", []);
        const index = accounts.findIndex(a => getAccountKey(a) === String(key));
        if (index < 0) return;

        if (decision === "rejected") {
            const reason = prompt("Motivo da rejeição (opcional):", "A conta necessita de revisão.");
            accounts[index].approvalStatus = "rejected";
            accounts[index].accountStatus = "rejected";
            accounts[index].official = false;
            accounts[index].approvalReason = reason || "";
            accounts[index].rejectedAt = new Date().toISOString();
            accounts[index].approvedAt = "";
        } else {
            accounts[index].approvalStatus = "approved";
            accounts[index].accountStatus = "active";
            accounts[index].official = true;
            accounts[index].approvalReason = "";
            accounts[index].approvedAt = new Date().toISOString();
            accounts[index].rejectedAt = "";
        }

        write("apsan_accounts", accounts);

        /* A decisão da Direção deve ficar persistida também no Realtime Database.
         * Antes, ficava apenas no localStorage deste aparelho e a sincronização
         * podia trazer novamente o estado "pending".
         */
        try {
            if (window.apsanCloud && typeof window.apsanCloud.saveAccount === "function") {
                await window.apsanCloud.saveAccount(accounts[index]);
            }
        } catch (error) {
            console.warn("Falha ao sincronizar a decisão da Direção:", error);
        }

        render();
    }

    function openUserProfile(account) {
        const data = getUserProfileData(account);
        const modal = document.getElementById("adminUserProfileModal");
        const content = document.getElementById("adminUserProfileContent");
        if (!modal || !content) return;

        const photoMarkup = data.photo
            ? '<img class="admin-user-profile-photo" src="' + esc(data.photo) + '" alt="Foto de ' + esc(data.name) + '">'
            : '<div class="admin-user-profile-letter">' + esc((data.name.charAt(0) || "U").toUpperCase()) + '</div>';

        const statusLabel = ["blocked","suspended","rejected"].includes(data.status) ? "Bloqueada" : "Ativa";
        const location = [data.province, data.country].filter(Boolean).join(" · ") || "Localização não definida";
        const registered = data.createdAt ? new Date(data.createdAt).toLocaleDateString("pt-AO") : "Não disponível";

        content.innerHTML = `
            <div class="admin-user-profile-head">
                <div class="admin-user-profile-avatar">${photoMarkup}</div>
                <div class="admin-user-profile-title">
                    <span class="admin-user-profile-type">${esc(data.type)}</span>
                    <h3>${esc(data.name)}</h3>
                    <span class="admin-status ${statusLabel === "Bloqueada" ? "rejected" : ""}">${statusLabel}</span>
                </div>
            </div>
            <div class="admin-user-profile-grid">
                <div class="admin-detail-box"><small>Utilizador</small><strong>${esc(data.username || "Não definido")}</strong></div>
                <div class="admin-detail-box"><small>Contacto</small><strong>${esc(data.phone || "Contacto protegido")}</strong></div>
                <div class="admin-detail-box"><small>Localização</small><strong>${esc(location)}</strong></div>
                <div class="admin-detail-box"><small>Registado em</small><strong>${esc(registered)}</strong></div>
            </div>
            <div class="admin-user-profile-bio">
                <small>Sobre o utilizador</small>
                <p>${esc(data.bio || "Este utilizador ainda não adicionou uma biografia.")}</p>
            </div>
            <div class="admin-modal-buttons">
                <button class="admin-cancel" type="button" data-close-admin-modal="adminUserProfileModal">Fechar</button>
            </div>`;
        modal.classList.add("open");
    }

    function render() {
        const accounts = read("apsan_accounts", []);
        const profiles = read("apsan_professors", []);
        const enrollments = read("apsan_enrollments", []);
        const teachers = accounts.filter(a => a?.type === "professor");
        const students = accounts.filter(a => a?.type === "aluno");
        const courses = profiles.filter(p => p?.published && p?.adminStatus !== "rejected");
        const allCourses = profiles.filter(p => p?.course);

        document.getElementById("adminUserCount").textContent = accounts.length;
        document.getElementById("adminTeacherCount").textContent = teachers.length;
        document.getElementById("adminStudentCount").textContent = students.length;
        document.getElementById("adminCourseCount").textContent = courses.length;
        document.getElementById("adminTeacherStatus").textContent = courses.length + " publicados";
        document.getElementById("adminEnrollmentCount").textContent = enrollments.length + " matrículas";

        const users = document.getElementById("adminUsersList");
        if (users) users.innerHTML = accounts.length ? accounts.map(a => {
            const label = a.type === "professor" ? "Professor" : a.type === "aluno" ? "Aluno" : a.type === "direcao" ? "Direção" : "Utilizador";
            const icon = a.type === "professor" ? "👨‍🏫" : a.type === "aluno" ? "👤" : a.type === "direcao" ? "⚙️" : "👥";
            const approval = getAccountApprovalState(a);
            const statusText = approval === "pending" ? "Pendente" : approval === "rejected" ? "Rejeitada" : "Oficial";
            const statusClass = approval === "pending" ? "pending" : approval === "rejected" ? "rejected" : "";
            const key = getAccountKey(a);
            const decisionButtons = approval === "pending"
                ? '<button type="button" class="admin-action approve" data-approve-account="' + esc(key) + '">Aprovar</button><button type="button" class="admin-action reject" data-reject-account="' + esc(key) + '">Rejeitar</button>'
                : approval === "rejected"
                    ? '<button type="button" class="admin-action approve" data-approve-account="' + esc(key) + '">Aprovar</button>'
                    : '<button type="button" class="admin-action reject" data-reject-account="' + esc(key) + '">Rejeitar</button>';
            return `<div class="admin-row">${userAvatarMarkup(a, a.name || label)}<div><strong>${esc(a.name || label)}</strong><small>${esc(label)} · ${esc(a.phone || "Contacto protegido")}</small></div><div class="admin-actions"><button type="button" class="admin-action view" data-view-user="${esc(key)}">Ver perfil</button>${decisionButtons}</div><span class="admin-status ${statusClass}">${statusText}</span></div>`;
        }).join("") : '<p class="admin-empty">Nenhum utilizador registado.</p>';

        const teacherList = document.getElementById("adminTeachersList");
        if (teacherList) teacherList.innerHTML = teachers.length ? teachers.map(a => {
            const profile = courses.find(p => p.teacherPhone === a.phone);
            const approval = getAccountApprovalState(a);
            const key = getAccountKey(a);
            const decisionButtons = approval === "pending"
                ? '<button type="button" class="admin-action approve" data-approve-account="' + esc(key) + '">Aprovar</button><button type="button" class="admin-action reject" data-reject-account="' + esc(key) + '">Rejeitar</button>'
                : approval === "rejected"
                    ? '<button type="button" class="admin-action approve" data-approve-account="' + esc(key) + '">Aprovar</button>'
                    : '<button type="button" class="admin-action reject" data-reject-account="' + esc(key) + '">Rejeitar</button>';
            return `<div class="admin-row">${userAvatarMarkup(a, a.name || "Professor")}<div><strong>${esc(a.name || "Professor")}</strong><small>${esc(a.phone || "")}</small></div><div class="admin-actions"><button type="button" class="admin-action view" data-view-user="${esc(key)}">Ver perfil</button>${decisionButtons}</div><span class="admin-status ${approval === "pending" ? "pending" : approval === "rejected" ? "rejected" : ""}">${approval === "pending" ? "Pendente" : approval === "rejected" ? "Rejeitado" : (profile ? "Publicado" : "Sem perfil")}</span></div>`;
        }).join("") : '<p class="admin-empty">Nenhum professor registado.</p>';

        const studentList = document.getElementById("adminStudentsList");
        if (studentList) studentList.innerHTML = students.length ? students.map(a => {
            const approval = getAccountApprovalState(a);
            const key = getAccountKey(a);
            const decisionButtons = approval === "pending"
                ? '<button type="button" class="admin-action approve" data-approve-account="' + esc(key) + '">Aprovar</button><button type="button" class="admin-action reject" data-reject-account="' + esc(key) + '">Rejeitar</button>'
                : approval === "rejected"
                    ? '<button type="button" class="admin-action approve" data-approve-account="' + esc(key) + '">Aprovar</button>'
                    : '<button type="button" class="admin-action reject" data-reject-account="' + esc(key) + '">Rejeitar</button>';
            const statusText = approval === "pending" ? "Pendente" : approval === "rejected" ? "Rejeitado" : "Oficial";
            const statusClass = approval === "pending" ? "pending" : approval === "rejected" ? "rejected" : "";
            return '<div class="admin-row">' +
                userAvatarMarkup(a, a.name || "Aluno") +
                '<div><strong>' + esc(a.name || "Aluno") + '</strong><small>' + esc(a.phone || "") + '</small></div>' +
                '<div class="admin-actions"><button type="button" class="admin-action view" data-view-user="' + esc(key) + '">Ver perfil</button>' + decisionButtons + '</div>' +
                '<span class="admin-status ' + statusClass + '">' + statusText + '</span>' +
                '</div>';
        }).join("") : '<p class="admin-empty">Nenhum aluno registado.</p>';

        const courseList = document.getElementById("adminCoursesList");
        if (courseList) courseList.innerHTML = allCourses.length ? allCourses.map(p => {
            const teacher = findAccountByPhone(p.teacherPhone, "professor");
            const status = p.adminStatus === "rejected"
                ? '<span class="admin-status rejected">Rejeitado</span>'
                : p.adminStatus === "approved"
                    ? '<span class="admin-status">Aprovado</span>'
                    : '<span class="admin-status pending">Para analisar</span>';
            const key = p.id || (p.teacherPhone + "|" + p.course);
            return `<div class="admin-row">${teacher ? userAvatarMarkup(teacher, p.teacherName || teacher.name || "Professor") : '<div class="admin-row-icon">📚</div>'}<div><strong>${esc(p.course || "Curso")}</strong><small>${esc(p.teacherName || "Professor")} · ${esc(p.modality || "")}</small></div><div class="admin-actions"><button type="button" class="admin-action view" data-view-course="${esc(key)}">Observar</button><button type="button" class="admin-action edit" data-edit-course="${esc(key)}">Editar</button><button type="button" class="admin-action approve" data-approve-course="${esc(key)}">Aprovar</button><button type="button" class="admin-action reject" data-reject-course="${esc(key)}">Rejeitar</button></div>${status}</div>`;
        }).join("") : '<p class="admin-empty">Nenhum curso publicado.</p>';

        const enrollmentList = document.getElementById("adminEnrollmentsList");
        if (enrollmentList) enrollmentList.innerHTML = enrollments.length ? enrollments.map(e => {
            const status = e.status === "official" ? '<span class="admin-status">Aprovada</span>' :
                ["rejected", "cancelled"].includes(e.status) ? '<span class="admin-status rejected">Rejeitada</span>' :
                '<span class="admin-status pending">Pendente</span>';
            const actions = e.status === "official" ? "" :
                `<button type="button" class="admin-action approve" data-approve-enrollment="${esc(e.id)}">Aprovar</button><button type="button" class="admin-action reject" data-reject-enrollment="${esc(e.id)}">Rejeitar</button>`;
            return `<div class="admin-row">${(() => { const s = findAccountByPhone(e.studentPhone, "aluno"); const t = findAccountByPhone(e.teacherPhone, "professor"); return '<div class="admin-participants">' + (s ? userAvatarMarkup(s, e.studentName || "Aluno") : '<div class="admin-row-icon">👤</div>') + (t ? userAvatarMarkup(t, e.teacherName || "Professor") : '<div class="admin-row-icon">👨‍🏫</div>') + '</div>'; })()}<div><strong>${esc(e.course || "Curso")}</strong><small>${esc(e.studentName || "Aluno")} → ${esc(e.teacherName || "Professor")} · ${formatKz(e.price)}</small></div><div class="admin-actions"><button type="button" class="admin-action view" data-view-enrollment="${esc(e.id)}">Observar</button>${actions}<button type="button" class="admin-action edit" data-edit-enrollment="${esc(e.id)}">Editar</button></div>${status}</div>`;
        }).join("") : '<p class="admin-empty">Nenhuma matrícula registada.</p>';

        const payments = document.getElementById("adminPaymentsList");
        if (payments) payments.innerHTML = enrollments.length ? enrollments.map(e => {
            const status = e.paymentStatus === "confirmed" ? "Pagamento confirmado" : e.status === "rejected" ? "Pagamento rejeitado" : "Aguardando confirmação";
            const student = findAccountByPhone(e.studentPhone, "aluno");
            const photo = student ? getUserPhoto(student) : "";
            const avatar = photo
                ? '<img class="admin-payment-avatar" src="' + esc(photo) + '" alt="Foto de ' + esc(e.studentName || "Aluno") + '">'
                : '<div class="admin-payment-avatar admin-payment-avatar-letter">👤</div>';
            const paymentDate = e.confirmedAt || e.updatedAt || e.createdAt || e.paymentDate || "";
            let dateText = "Data não informada";
            if (paymentDate) {
                try {
                    dateText = new Date(paymentDate).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
                } catch (error) {
                    dateText = String(paymentDate);
                }
            }
            const course = e.course || "Curso";
            const receiptText = e.receipt ? "Comprovativo disponível" : "Sem comprovativo";
            return '<article class="admin-payment-card">' +
                '<div class="admin-payment-main">' +
                    avatar +
                    '<div class="admin-payment-info">' +
                        '<div class="admin-payment-topline"><strong>' + formatKz(e.price) + '</strong><span class="admin-payment-status ' + (e.paymentStatus === "confirmed" ? "confirmed" : e.status === "rejected" ? "rejected" : "pending") + '">' + esc(status) + '</span></div>' +
                        '<strong class="admin-payment-student">' + esc(e.studentName || "Aluno") + '</strong>' +
                        '<small>' + esc(course) + ' · ' + esc(e.teacherName || "Professor") + '</small>' +
                        '<small>' + esc(dateText) + ' · ' + receiptText + '</small>' +
                    '</div>' +
                '</div>' +
                '<div class="admin-payment-actions">' +
                    '<button type="button" class="admin-action view" data-view-enrollment="' + esc(e.id) + '">' + (e.receipt ? "Ver comprovativo" : "Observar") + '</button>' +
                '</div>' +
            '</article>';
        }).join("") : '<p class="admin-empty">Nenhum pagamento registado.</p>';

        const moderation = document.getElementById("adminModerationList");
        if (moderation) moderation.innerHTML = '<p class="admin-empty">Nenhuma ocorrência de moderação pendente.</p>';

        const occurrences = document.getElementById("adminOccurrencesList");
        if (occurrences) {
            const rows = enrollments.filter(e => e.status === "rejected").map(e =>
                `<div class="admin-row">${(() => { const s = findAccountByPhone(e.studentPhone, "aluno"); return s ? userAvatarMarkup(s, e.studentName || "Aluno") : '<div class="admin-row-icon">❌</div>'; })()}<div><strong>Matrícula rejeitada</strong><small>${esc(e.studentName || "Aluno")} · ${esc(e.course || "Curso")} · ${esc(e.rejectionReason || "Sem motivo registado")}</small></div></div>`
            );
            occurrences.innerHTML = rows.length ? rows.join("") : '<p class="admin-empty">Nenhuma ocorrência registada.</p>';
        }

        const activity = document.getElementById("adminActivityList");
        if (activity) {
            const rows = courses.map(p => `<div class="admin-row">${(() => { const t = findAccountByPhone(p.teacherPhone, "professor"); return t ? userAvatarMarkup(t, p.teacherName || "Professor") : '<div class="admin-row-icon">•</div>'; })()}<div><strong>Perfil publicado: ${esc(p.teacherName || "Professor")}</strong></div></div>`);
            activity.innerHTML = rows.length ? rows.slice(-12).reverse().join("") : '<p class="admin-empty">Ainda não existem atividades.</p>';
        }

        /* Reaplica a preferência da Direção depois de cada render para que
           textos dinâmicos também respeitem o idioma escolhido. */
        if (window.APSANSettings) {
            window.APSANSettings.apply(window.APSANSettings.get());
        }
    }

    function getCourseKey(profile) {
        return String(profile?.id || (profile?.teacherPhone + "|" + profile?.course) || "");
    }

    function getCourse(key) {
        return read("apsan_professors", []).find(p => getCourseKey(p) === String(key)) || null;
    }

    function updateCourse(key, changes) {
        const list = read("apsan_professors", []);
        const index = list.findIndex(p => getCourseKey(p) === String(key));
        if (index < 0) return null;
        Object.assign(list[index], changes, { updatedAt: new Date().toISOString() });
        write("apsan_professors", list);
        return list[index];
    }

    function openCourseView(key) {
        const p = getCourse(key);
        if (!p) return;
        const teacher = findAccountByPhone(p.teacherPhone, "professor");
        const content = document.getElementById("adminCourseViewContent");
        if (!content) return;
        const photo = teacher ? getUserPhoto(teacher) : (p.teacherPhoto || "");
        const cover = p.cover || "";
        content.innerHTML = `
            <div class="admin-course-view-head">
                <div class="admin-course-cover">${cover ? '<img src="' + esc(cover) + '" alt="Capa do curso">' : '<div>📚</div>'}</div>
                <div><span class="admin-user-profile-type">Curso / disciplina</span><h3>${esc(p.course || "Curso")}</h3><p>${esc(p.teacherName || "Professor")}</p></div>
            </div>
            <div class="admin-course-teacher"><div class="admin-user-profile-avatar">${photo ? '<img class="admin-user-profile-photo" src="' + esc(photo) + '" alt="Foto do professor">' : '<div class="admin-user-profile-letter">P</div>'}</div><div><small>Professor responsável</small><strong>${esc(p.teacherName || "Professor")}</strong></div></div>
            <div class="admin-user-profile-grid">
                <div class="admin-detail-box"><small>Modalidade</small><strong>${esc(p.modality || "—")}</strong></div>
                <div class="admin-detail-box"><small>Preço</small><strong>${formatKz(p.price)}</strong></div>
                <div class="admin-detail-box"><small>Horários</small><strong>${esc(p.schedules || "—")}</strong></div>
                <div class="admin-detail-box"><small>Experiência</small><strong>${esc(p.experience || "—")}</strong></div>
            </div>
            <div class="admin-user-profile-bio"><small>Descrição da matéria / curso</small><p>${esc(p.description || "Sem descrição.")}</p></div>
            <div class="admin-user-profile-bio"><small>Vantagens / diferenciais</small><p>${esc(p.advantages || "Não informado.")}</p></div>
            <div class="admin-modal-buttons">
                <button class="admin-save" type="button" data-approve-course="${esc(key)}">Aprovar</button>
                <button class="admin-action reject" type="button" data-reject-course="${esc(key)}">Rejeitar</button>
                <button class="admin-action edit" type="button" data-edit-course="${esc(key)}">Editar</button>
                <button class="admin-cancel" type="button" data-close-admin-modal="adminCourseViewModal">Fechar</button>
            </div>`;
        document.getElementById("adminCourseViewModal")?.classList.add("open");
    }

    function openCourseEdit(key) {
        const p = getCourse(key);
        if (!p) return;
        document.getElementById("editCourseKey").value = key;
        document.getElementById("editCourseName").value = p.course || "";
        document.getElementById("editCourseDescription").value = p.description || "";
        document.getElementById("editCourseModality").value = p.modality || "Online";
        document.getElementById("editCoursePrice").value = p.price || "";
        document.getElementById("editCourseSchedules").value = p.schedules || "";
        document.getElementById("editCourseExperience").value = p.experience || "";
        document.getElementById("editCourseAdvantages").value = p.advantages || "";
        document.getElementById("adminCourseEditModal")?.classList.add("open");
    }

    function setCourseDecision(key, decision) {
        const p = getCourse(key);
        if (!p) return;
        if (decision === "rejected") {
            const reason = prompt("Motivo da rejeição (opcional):", "Conteúdo do curso necessita de revisão.");
            updateCourse(key, { adminStatus: "rejected", adminDecision: "rejected", rejectionReason: reason || "", published: false });
        } else {
            updateCourse(key, { adminStatus: "approved", adminDecision: "approved", approvedAt: new Date().toISOString(), published: true, rejectionReason: "" });
        }
        document.getElementById("adminCourseViewModal")?.classList.remove("open");
        document.getElementById("adminCourseEditModal")?.classList.remove("open");
        render();
    }

    function openView(id) {
        const e = getEnrollment(id);
        if (!e) return;
        const content = document.getElementById("adminViewContent");
        content.innerHTML = `
            <div class="admin-detail-grid">
                <div class="admin-detail-box"><small>Aluno</small><strong>${esc(e.studentName)}</strong></div>
                <div class="admin-detail-box"><small>Telefone</small><strong>${esc(e.studentPhone)}</strong></div>
                <div class="admin-detail-box"><small>Professor</small><strong>${esc(e.teacherName)}</strong></div>
                <div class="admin-detail-box"><small>Curso</small><strong>${esc(e.course)}</strong></div>
                <div class="admin-detail-box"><small>Valor</small><strong>${formatKz(e.price)}</strong></div>
                <div class="admin-detail-box"><small>Método</small><strong>${esc(e.paymentMethod || "—")}</strong></div>
                <div class="admin-detail-box"><small>Referência</small><strong>${esc(e.paymentReference || "—")}</strong></div>
                <div class="admin-detail-box"><small>Estado</small><strong>${esc(e.status === "official" ? "Aprovada" : e.status === "rejected" ? "Rejeitada" : "Pendente")}</strong></div>
            </div>
            <div class="admin-detail-box" style="margin-top:10px"><small>Observação do aluno</small><strong>${esc(e.paymentNote || "Sem observação.")}</strong></div>
            <h3 style="margin:18px 0 8px">Comprovativo de pagamento</h3>
            ${e.receipt ? (String(e.receipt).startsWith("data:image/") ? `<div class="admin-receipt"><img src="${esc(e.receipt)}" alt="Comprovativo de pagamento"></div>` : String(e.receipt).startsWith("data:application/pdf") ? `<div class="admin-receipt"><iframe src="${esc(e.receipt)}" title="Comprovativo PDF"></iframe></div>` : '<p class="admin-empty">Comprovativo guardado, mas não pode ser visualizado aqui.</p>') : '<p class="admin-empty">Este pagamento ainda não tem comprovativo.</p>'}
            <div class="admin-modal-buttons">
                ${e.status !== "official" ? `<button class="admin-save" type="button" data-modal-approve="${esc(e.id)}">Aprovar</button>` : ""}
                ${e.status !== "rejected" ? `<button class="admin-action reject" type="button" data-modal-reject="${esc(e.id)}">Rejeitar</button>` : ""}
                <button class="admin-cancel" type="button" data-close-admin-modal="adminViewModal">Fechar</button>
            </div>`;
        document.getElementById("adminViewModal").classList.add("open");
    }

    function approve(id) {
        const e = getEnrollment(id);
        if (!e) return;
        updateEnrollment(id, { paymentStatus: "confirmed", status: "official", confirmedAt: new Date().toISOString(), adminDecision: "approved" });
        const legacy = read("apsan_teacher_students", []);
        if (!legacy.some(x => x.studentPhone === e.studentPhone && x.teacherPhone === e.teacherPhone)) {
            legacy.push({ id: e.id, name: e.studentName, studentName: e.studentName, studentPhone: e.studentPhone, teacherPhone: e.teacherPhone, status: "confirmed" });
            write("apsan_teacher_students", legacy);
        }
        document.getElementById("adminViewModal").classList.remove("open");
        render();
    }

    function reject(id) {
        const reason = prompt("Motivo da rejeição (opcional):", "Comprovativo/pagamento não validado.");
        updateEnrollment(id, { paymentStatus: "rejected", status: "rejected", rejectedAt: new Date().toISOString(), rejectionReason: reason || "" });
        document.getElementById("adminViewModal").classList.remove("open");
        render();
    }

    function edit(id) {
        const e = getEnrollment(id);
        if (!e) return;
        document.getElementById("editEnrollmentId").value = e.id;
        document.getElementById("editPrice").value = e.price || "";
        document.getElementById("editReference").value = e.paymentReference || "";
        document.getElementById("editNote").value = e.adminNote || e.paymentNote || "";
        document.getElementById("adminEditModal").classList.add("open");
    }

    document.addEventListener("click", event => {
        const approveAccount = event.target.closest("[data-approve-account]");
        if (approveAccount) return setAccountDecision(approveAccount.dataset.approveAccount, "approved");
        const rejectAccount = event.target.closest("[data-reject-account]");
        if (rejectAccount) return setAccountDecision(rejectAccount.dataset.rejectAccount, "rejected");
        const userView = event.target.closest("[data-view-user]");
        if (userView) {
            const key = userView.dataset.viewUser;
            const account = read("apsan_accounts", []).find(a =>
                String(a.id || a.phone || a.username || a.name || "") === String(key)
            );
            if (account) return openUserProfile(account);
        }
        const courseView = event.target.closest("[data-view-course]");
        if (courseView) return openCourseView(courseView.dataset.viewCourse);
        const courseEdit = event.target.closest("[data-edit-course]");
        if (courseEdit) return openCourseEdit(courseEdit.dataset.editCourse);
        const courseApprove = event.target.closest("[data-approve-course]");
        if (courseApprove) return setCourseDecision(courseApprove.dataset.approveCourse, "approved");
        const courseReject = event.target.closest("[data-reject-course]");
        if (courseReject) return setCourseDecision(courseReject.dataset.rejectCourse, "rejected");
        const view = event.target.closest("[data-view-enrollment]");
        if (view) return openView(view.dataset.viewEnrollment);
        const approveButton = event.target.closest("[data-approve-enrollment], [data-modal-approve]");
        if (approveButton) return approve(approveButton.dataset.approveEnrollment || approveButton.dataset.modalApprove);
        const rejectButton = event.target.closest("[data-reject-enrollment], [data-modal-reject]");
        if (rejectButton) return reject(rejectButton.dataset.rejectEnrollment || rejectButton.dataset.modalReject);
        const editButton = event.target.closest("[data-edit-enrollment]");
        if (editButton) return edit(editButton.dataset.editEnrollment);
        const close = event.target.closest("[data-close-admin-modal]");
        if (close) document.getElementById(close.dataset.closeAdminModal)?.classList.remove("open");
        if (event.target.classList.contains("admin-modal")) event.target.classList.remove("open");
    });

    document.getElementById("adminCourseEditForm")?.addEventListener("submit", event => {
        event.preventDefault();
        const key = document.getElementById("editCourseKey").value;
        updateCourse(key, {
            course: document.getElementById("editCourseName").value.trim(),
            description: document.getElementById("editCourseDescription").value.trim(),
            modality: document.getElementById("editCourseModality").value,
            price: document.getElementById("editCoursePrice").value.trim(),
            schedules: document.getElementById("editCourseSchedules").value.trim(),
            experience: document.getElementById("editCourseExperience").value.trim(),
            advantages: document.getElementById("editCourseAdvantages").value.trim()
        });
        document.getElementById("adminCourseEditModal")?.classList.remove("open");
        render();
    });

    document.getElementById("adminEditForm")?.addEventListener("submit", event => {
        event.preventDefault();
        updateEnrollment(document.getElementById("editEnrollmentId").value, {
            price: document.getElementById("editPrice").value.trim(),
            paymentReference: document.getElementById("editReference").value.trim(),
            adminNote: document.getElementById("editNote").value.trim(),
            updatedAt: new Date().toISOString()
        });
        document.getElementById("adminEditModal").classList.remove("open");
        render();
    });

    const directionProfileKey = "apsan_direction_profile";
    let directionProfile = Object.assign({
        name: currentAccount.name || "Direção APSAN Academy",
        nif: "",
        location: "",
        logo: ""
    }, read(directionProfileKey, {}));

    function renderDirectionProfileAvatar() {
        const avatar = document.getElementById("adminTopAvatar");
        const letter = document.getElementById("adminTopAvatarLetter");
        const image = directionProfile.logo || currentAccount.photo || currentAccount.profilePhoto || currentAccount.avatar || "";
        if (image && avatar) {
            avatar.src = image;
            avatar.style.display = "block";
            if (letter) letter.style.display = "none";
        } else if (letter) {
            letter.textContent = String(directionProfile.name || "Direção").trim().charAt(0).toUpperCase() || "D";
            letter.style.display = "grid";
            if (avatar) avatar.style.display = "none";
        }
    }

    function loadDirectionProfileForm() {
        document.getElementById("adminDirectionName").value = directionProfile.name || "";
        document.getElementById("adminDirectionNif").value = directionProfile.nif || "";
        document.getElementById("adminDirectionLocation").value = directionProfile.location || "";
        const preview = document.getElementById("adminDirectionLogoPreview");
        if (preview) preview.innerHTML = directionProfile.logo
            ? '<img src="' + esc(directionProfile.logo) + '" alt="Logotipo da Direção">'
            : '<span>' + esc((directionProfile.name || "D").charAt(0).toUpperCase()) + '</span>';
    }

    document.getElementById("adminProfileButton")?.addEventListener("click", () => {
        loadDirectionProfileForm();
        document.getElementById("adminDirectionProfileModal")?.classList.add("open");
    });

    document.getElementById("adminDirectionLogo")?.addEventListener("change", event => {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) return;
        const reader = new FileReader();
        reader.onload = () => {
            directionProfile.logo = String(reader.result || "");
            loadDirectionProfileForm();
        };
        reader.readAsDataURL(file);
    });

    document.getElementById("adminDirectionProfileForm")?.addEventListener("submit", event => {
        event.preventDefault();
        directionProfile = {
            name: document.getElementById("adminDirectionName").value.trim() || "Direção APSAN Academy",
            nif: document.getElementById("adminDirectionNif").value.trim(),
            location: document.getElementById("adminDirectionLocation").value.trim(),
            logo: directionProfile.logo || ""
        };
        write(directionProfileKey, directionProfile);

        const accounts = read("apsan_accounts", []);
        const index = accounts.findIndex(a => a.type === "direcao");
        if (index >= 0) {
            accounts[index] = Object.assign({}, accounts[index], {
                name: directionProfile.name,
                photo: directionProfile.logo,
                nif: directionProfile.nif,
                location: directionProfile.location
            });
            write("apsan_accounts", accounts);
        }

        const session = Object.assign({}, currentAccount, {
            name: directionProfile.name,
            photo: directionProfile.logo,
            nif: directionProfile.nif,
            location: directionProfile.location
        });
        localStorage.setItem("apsan_account", JSON.stringify(session));
        directionProfile = Object.assign({}, directionProfile);
        renderDirectionProfileAvatar();
        document.getElementById("adminDirectionProfileModal")?.classList.remove("open");
        render();
    });
    document.getElementById("adminLogoutSide")?.addEventListener("click", () => {
        ["apsan_logged_in", "apsan_phone", "apsan_user_type", "apsan_account"].forEach(k => localStorage.removeItem(k));
        window.location.href = "../../index.html";
    });

    renderDirectionProfileAvatar();

    const settingsKey = "apsan_admin_settings";
    const savedSettings = Object.assign({ profileApproval: "manual", courseApproval: "manual", platformStatus: "active" }, read(settingsKey, {}));

    ["adminProfileApproval", "adminCourseApproval", "adminPlatformStatus"].forEach((id, i) => {
        const el = document.getElementById(id);
        if (el) el.value = [savedSettings.profileApproval, savedSettings.courseApproval, savedSettings.platformStatus][i];
    });

    const appSettings = window.APSANSettings
        ? window.APSANSettings.get()
        : { language: "pt", wallpaper: "default" };

    const languageSelect = document.getElementById("adminLanguageSelect");
    if (languageSelect) languageSelect.value = appSettings.language === "en" ? "en" : "pt";

    const wallpaperButtons = document.querySelectorAll(".admin-direction-wallpapers [data-wallpaper-choice]");
    wallpaperButtons.forEach(button => {
        button.classList.toggle(
            "active",
            button.getAttribute("data-wallpaper-choice") === (appSettings.wallpaper || "default")
        );
        button.addEventListener("click", () => {
            wallpaperButtons.forEach(item => item.classList.remove("active"));
            button.classList.add("active");
        });
    });

    document.getElementById("adminSaveSettings")?.addEventListener("click", () => {
        const nextAppSettings = Object.assign({}, appSettings, {
            language: languageSelect?.value === "en" ? "en" : "pt",
            wallpaper: document.querySelector(".admin-direction-wallpapers [data-wallpaper-choice].active")?.getAttribute("data-wallpaper-choice") || "default"
        });

        write(settingsKey, {
            profileApproval: document.getElementById("adminProfileApproval").value,
            courseApproval: document.getElementById("adminCourseApproval").value,
            platformStatus: document.getElementById("adminPlatformStatus").value
        });

        if (window.APSANSettings) {
            window.APSANSettings.save(nextAppSettings);
        }

        const msg = document.getElementById("adminSettingsMessage");
        if (msg) {
            msg.textContent = nextAppSettings.language === "en"
                ? "Settings saved successfully."
                : "Configurações guardadas.";
            msg.style.color = "#16803c";
        }

        if (nextAppSettings.language !== (appSettings.language || "pt")) {
            setTimeout(() => window.location.reload(), 300);
        }
    });

    const hash = location.hash.slice(1);
    showAdminView(hash && document.getElementById(hash) ? hash : "admin-dashboard-view", { instant: true });
    addEventListener("hashchange", () => showAdminView(location.hash.slice(1) || "admin-dashboard-view", { instant: true, keepHash: true }));

    render();
});
