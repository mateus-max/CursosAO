(function () {
    "use strict";

    const ROLE_BY_BODY = document.body.classList.contains("admin-page")
        ? "direcao"
        : document.body.classList.contains("professor-page")
            ? "professor"
            : document.body.classList.contains("student-page")
                ? "aluno"
                : "";

    if (!ROLE_BY_BODY) return;

    const read = function (key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || "null");
            return value == null ? fallback : value;
        } catch (_) {
            return fallback;
        }
    };

    const write = function (key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    };

    const normalizePhone = function (value) {
        return String(value || "").replace(/\D/g, "");
    };

    const account = read("apsan_account", {}) || {};
    const identity = normalizePhone(account.phone || localStorage.getItem("apsan_phone")) || String(account.email || account.id || ROLE_BY_BODY);
    const recipientKey = ROLE_BY_BODY + ":" + identity;

    function notifications() {
        return Array.isArray(read("apsan_header_notifications", []))
            ? read("apsan_header_notifications", [])
            : [];
    }

    function messageNotifications() {
        const all = read("apsan_message_notifications", []);
        if (!Array.isArray(all)) return [];
        if (ROLE_BY_BODY === "direcao") return [];
        return all.filter(function (item) {
            return normalizePhone(item.recipientPhone) === identity && !item.readAt;
        });
    }

    function genericUnread() {
        return notifications().filter(function (item) {
            return item.recipientKey === recipientKey && !item.readAt;
        });
    }

    function addNotification(title, text, kind, link) {
        const all = notifications();
        const duplicate = all.some(function (item) {
            return item.recipientKey === recipientKey &&
                item.kind === kind &&
                item.signature === String(text) &&
                Date.now() - new Date(item.createdAt || 0).getTime() < 15000;
        });
        if (duplicate) return;
        all.push({
            id: "hn_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
            recipientKey: recipientKey,
            recipientType: ROLE_BY_BODY,
            title: title,
            text: text,
            kind: kind || "update",
            link: link || "",
            signature: String(text),
            createdAt: new Date().toISOString(),
            readAt: null
        });
        write("apsan_header_notifications", all.slice(-100));
    }

    function getBadge() {
        return document.getElementById(ROLE_BY_BODY === "direcao"
            ? "adminHeaderNotificationBadge"
            : ROLE_BY_BODY === "professor"
                ? "professorHeaderNotificationBadge"
                : "studentHeaderNotificationBadge");
    }

    function updateBadge() {
        const badge = getBadge();
        if (!badge) return;
        const count = genericUnread().length + messageNotifications().length;
        badge.textContent = count > 99 ? "99+" : String(count);
        badge.hidden = count === 0;
    }

    function panel() {
        return document.getElementById("apsanHeaderNotifications");
    }

    function renderPanel() {
        const box = document.getElementById("apsanHeaderNotificationList");
        if (!box) return;

        const generic = genericUnread();
        const messages = messageNotifications().map(function (item) {
            return {
                id: item.id,
                kind: "message",
                title: "Nova mensagem",
                text: (item.senderName ? item.senderName + ": " : "") + (item.textPreview || "Tem uma nova mensagem."),
                createdAt: item.createdAt,
                link: "mensagens.html",
                messageId: item.id
            };
        });

        const items = generic.map(function (item) {
            return item;
        }).concat(messages).sort(function (a, b) {
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });

        if (!items.length) {
            box.innerHTML = '<div class="apsan-header-notification-empty">Não há novas notificações.</div>';
            return;
        }

        box.innerHTML = items.slice(0, 30).map(function (item) {
            const safeTitle = String(item.title || "Atualização").replace(/[&<>"]/g, "");
            const safeText = String(item.text || "").replace(/[&<>"]/g, "");
            const date = item.createdAt
                ? new Date(item.createdAt).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })
                : "";
            return '<button type="button" class="apsan-header-notification-item" data-header-notification-kind="' +
                String(item.kind || "update").replace(/[^a-z-]/gi, "") + '" data-header-notification-link="' +
                String(item.link || "").replace(/"/g, "&quot;") + '">' +
                '<span class="apsan-header-notification-dot"></span>' +
                '<span class="apsan-header-notification-copy"><strong>' + safeTitle + '</strong><small>' +
                safeText + '</small><time>' + date + '</time></span></button>';
        }).join("");
    }

    function markAllRead() {
        const all = notifications();
        let changed = false;
        all.forEach(function (item) {
            if (item.recipientKey === recipientKey && !item.readAt) {
                item.readAt = new Date().toISOString();
                changed = true;
            }
        });
        if (changed) write("apsan_header_notifications", all);

        if (ROLE_BY_BODY !== "direcao") {
            const msgs = read("apsan_message_notifications", []);
            if (Array.isArray(msgs)) {
                let msgChanged = false;
                msgs.forEach(function (item) {
                    if (normalizePhone(item.recipientPhone) === identity && !item.readAt) {
                        item.readAt = new Date().toISOString();
                        msgChanged = true;
                    }
                });
                if (msgChanged) write("apsan_message_notifications", msgs);
            }
        }
        updateBadge();
    }

    function openPanel() {
        const target = panel();
        if (!target) return;
        renderPanel();
        target.classList.add("open");
        target.setAttribute("aria-hidden", "false");
        // O contador desaparece ao abrir, mas a lista permanece visível
        // para o utilizador poder consultar o que chegou.
        markAllRead();
    }

    function closePanel() {
        const target = panel();
        if (!target) return;
        target.classList.remove("open");
        target.setAttribute("aria-hidden", "true");
        updateBadge();
    }

    function snapshotKey() {
        return "apsan_header_snapshot_" + recipientKey;
    }

    function currentSnapshot() {
        const enrollments = read("apsan_enrollments", []);
        const accounts = read("apsan_accounts", []);
        const relevantEnrollments = Array.isArray(enrollments)
            ? enrollments.filter(function (item) {
                if (ROLE_BY_BODY === "aluno") return normalizePhone(item.studentPhone) === identity;
                if (ROLE_BY_BODY === "professor") return normalizePhone(item.teacherPhone) === identity;
                return true;
            }).map(function (item) {
                return [
                    item.id, item.status, item.paymentStatus, item.updatedAt,
                    item.confirmedAt, item.rejectedAt, item.createdAt
                ].join("|");
            })
            : [];

        const relevantAccounts = Array.isArray(accounts)
            ? accounts.filter(function (item) {
                if (ROLE_BY_BODY === "direcao") return true;
                return normalizePhone(item.phone) === identity;
            }).map(function (item) {
                return [item.id, item.approvalStatus, item.accountStatus, item.updatedAt, item.createdAt].join("|");
            })
            : [];

        return JSON.stringify({
            enrollments: relevantEnrollments.sort(),
            accounts: relevantAccounts.sort()
        });
    }

    function checkForUpdates() {
        const key = snapshotKey();
        const current = currentSnapshot();
        const previous = localStorage.getItem(key);

        if (previous === null) {
            localStorage.setItem(key, current);
            return;
        }
        if (previous === current) return;

        const before = JSON.parse(previous || "{}");
        const after = JSON.parse(current || "{}");

        if (ROLE_BY_BODY === "aluno") {
            const beforeEnrollments = (before.enrollments || []).join("\n");
            const afterEnrollments = (after.enrollments || []).join("\n");
            if (beforeEnrollments !== afterEnrollments) {
                const mine = read("apsan_enrollments", []).filter(function (item) {
                    return normalizePhone(item.studentPhone) === identity;
                }).sort(function (a, b) {
                    return new Date(b.updatedAt || b.confirmedAt || b.rejectedAt || b.createdAt || 0) -
                        new Date(a.updatedAt || a.confirmedAt || a.rejectedAt || a.createdAt || 0);
                })[0];
                if (mine) {
                    const status = mine.status === "official" ? "confirmada" :
                        mine.status === "rejected" ? "rejeitada" : "atualizada";
                    addNotification("Atualização da matrícula", "A sua matrícula em " + (mine.course || "um curso") + " foi " + status + ".", "enrollment", "#studentEnrollmentsView");
                }
            }
        } else if (ROLE_BY_BODY === "professor") {
            const beforeEnrollments = (before.enrollments || []).join("\n");
            const afterEnrollments = (after.enrollments || []).join("\n");
            if (beforeEnrollments !== afterEnrollments) {
                const mine = read("apsan_enrollments", []).filter(function (item) {
                    return normalizePhone(item.teacherPhone) === identity;
                }).sort(function (a, b) {
                    return new Date(b.updatedAt || b.confirmedAt || b.rejectedAt || b.createdAt || 0) -
                        new Date(a.updatedAt || a.confirmedAt || a.rejectedAt || a.createdAt || 0);
                })[0];
                if (mine) {
                    addNotification("Atualização de matrícula", (mine.studentName || "Um aluno") + " teve uma matrícula atualizada em " + (mine.course || "um curso") + ".", "enrollment", "#alunos");
                }
            }
        } else if (ROLE_BY_BODY === "direcao") {
            const beforeAccounts = (before.accounts || []).join("\n");
            const afterAccounts = (after.accounts || []).join("\n");
            const beforeEnrollments = (before.enrollments || []).join("\n");
            const afterEnrollments = (after.enrollments || []).join("\n");
            if (beforeAccounts !== afterAccounts || beforeEnrollments !== afterEnrollments) {
                addNotification("Nova atualização", "Existem novas alterações que precisam da atenção da Direção.", "admin", "#admin-dashboard-view");
            }
        }

        localStorage.setItem(key, current);
        updateBadge();
        renderPanel();
    }

    function bind() {
        const button = document.getElementById("apsanHeaderNotificationButton");
        const close = document.getElementById("apsanHeaderNotificationClose");
        if (button) button.addEventListener("click", openPanel);
        if (close) close.addEventListener("click", closePanel);

        const overlay = panel();
        if (overlay) {
            overlay.addEventListener("click", function (event) {
                if (event.target === overlay) closePanel();
            });
        }

        const list = document.getElementById("apsanHeaderNotificationList");
        if (list) list.addEventListener("click", function (event) {
            const item = event.target.closest("[data-header-notification-link]");
            if (!item) return;
            const link = item.getAttribute("data-header-notification-link") || "";
            closePanel();
            if (link === "mensagens.html") {
                window.location.href = link;
                return;
            }
            if (link) {
                window.location.hash = link.replace(/^#/, "");
            }
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") closePanel();
        });

        window.addEventListener("storage", function (event) {
            if (event.key === "apsan_message_notifications" ||
                event.key === "apsan_header_notifications" ||
                event.key === "apsan_enrollments" ||
                event.key === "apsan_accounts") {
                checkForUpdates();
                updateBadge();
                renderPanel();
            }
        });

        updateBadge();
        renderPanel();
        checkForUpdates();
        setInterval(function () {
            checkForUpdates();
            updateBadge();
            renderPanel();
        }, 2500);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bind);
    } else {
        bind();
    }
})();