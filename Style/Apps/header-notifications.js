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
        const digits = String(value || "").replace(/\D/g, "");
        return digits.length > 9 ? digits.slice(-9) : digits;
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
            return normalizePhone(item.recipientPhone) === identity && !item.deletedAt;
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
        const count = genericUnread().length + messageNotifications().filter(function(item){ return !item.readAt; }).length;
        const badge = getBadge();
        if (badge) {
            badge.textContent = count > 99 ? "99+" : String(count);
            badge.hidden = count === 0;
        }
        // O menu lateral do aluno também precisa refletir as mensagens
        // recebidas, sem depender de abrir a página de mensagens.
        if (ROLE_BY_BODY === "aluno") {
            const menuBadge = document.getElementById("studentMessageMenuBadge");
            if (menuBadge) {
                menuBadge.textContent = count > 99 ? "99+" : String(count);
                menuBadge.hidden = count === 0;
            }
        } else if (ROLE_BY_BODY === "professor") {
            const menuBadge = document.getElementById("professorMessageMenuBadge");
            if (menuBadge) {
                const n = messageNotifications().filter(function(item){ return !item.readAt; }).length;
                menuBadge.textContent = n > 99 ? "99+" : String(n);
                menuBadge.hidden = n === 0;
            }
        }
    }

    function panel() {
        return document.getElementById("apsanHeaderNotifications");
    }

    function renderPanel() {
        const box = document.getElementById("apsanHeaderNotificationList");
        if (!box) return;

        const generic = notifications().filter(function (item) {
            return item && item.recipientKey === recipientKey && !item.deletedAt;
        });
        const messages = messageNotifications().map(function (item) {
            return {
                id: item.id,
                kind: "message",
                title: "Nova mensagem",
                text: (item.senderName ? item.senderName + ": " : "") + (item.textPreview || "Tem uma nova mensagem."),
                createdAt: item.createdAt,
                link: "mensagens.html",
                messageId: item.id,
                readAt: item.readAt
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
            return '<div class="apsan-header-notification-item' + (item.readAt ? ' is-read' : ' is-unread') + '" data-notification-id="' +
                String(item.id || "").replace(/[^a-zA-Z0-9_-]/g, "") + '">' +
                '<span class="apsan-header-notification-dot"></span>' +
                '<span class="apsan-header-notification-copy"><strong>' + safeTitle + '</strong><small>' +
                safeText + '</small><time>' + date + '</time></span>' +
                '<span class="apsan-header-notification-actions">' +
                '<button type="button" data-notification-action="view">Ver</button>' +
                '<button type="button" data-notification-action="delete">Eliminar</button>' +
                '</span></div>';
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

    function allVisibleNotifications() {
        const generic = notifications().filter(function (item) {
            return item && item.recipientKey === recipientKey && !item.deletedAt;
        });
        const messages = messageNotifications().map(function (item) {
            return {
                id: item.id,
                kind: "message",
                title: "Nova mensagem",
                text: (item.senderName ? item.senderName + ": " : "") + (item.textPreview || "Tem uma nova mensagem."),
                createdAt: item.createdAt,
                link: "mensagens.html",
                messageId: item.id,
                readAt: item.readAt
            };
        });
        return generic.concat(messages).sort(function (a, b) {
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });
    }

    function markNotificationRead(item) {
        if (!item) return;
        const now = new Date().toISOString();
        if (item.kind === "message" && item.messageId) {
            const msgs = read("apsan_message_notifications", []);
            if (Array.isArray(msgs)) {
                const msg = msgs.find(function (x) { return x && x.id === item.messageId; });
                if (msg) {
                    msg.readAt = msg.readAt || now;
                    write("apsan_message_notifications", msgs);
                }
            }
        } else {
            const all = notifications();
            const entry = all.find(function (x) { return x && x.id === item.id; });
            if (entry) {
                entry.readAt = entry.readAt || now;
                write("apsan_header_notifications", all);
            }
        }
        updateBadge();
    }

    function deleteNotification(item) {
        if (!item) return;
        const now = new Date().toISOString();
        if (item.kind === "message" && item.messageId) {
            const msgs = read("apsan_message_notifications", []);
            if (Array.isArray(msgs)) {
                const msg = msgs.find(function (x) { return x && x.id === item.messageId; });
                if (msg) {
                    msg.deletedAt = now;
                    write("apsan_message_notifications", msgs);
                }
            }
        } else {
            const all = notifications();
            const entry = all.find(function (x) { return x && x.id === item.id; });
            if (entry) {
                entry.deletedAt = now;
                write("apsan_header_notifications", all);
            }
        }
        renderPanel();
        updateBadge();
    }

    function forceHeaderBadgeSync() {
        const badge = getBadge();
        if (!badge) return;
        const unreadGeneric = genericUnread().length;
        const unreadMessages = messageNotifications().filter(function (item) {
            return !item.readAt && !item.deletedAt;
        }).length;
        const count = unreadGeneric + unreadMessages;
        badge.textContent = count > 99 ? "99+" : String(count);
        badge.hidden = count === 0;
    }

    function openPanel() {
        const target = panel();
        if (!target) return;
        renderPanel();
        forceHeaderBadgeSync();
        target.classList.add("open");
        target.setAttribute("aria-hidden", "false");
        // Abrir o painel não marca nem elimina notificações.
        // Cada notificação só fica lida quando o utilizador escolhe "Ver".
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

    async function bindCloudRealtime() {
        if (!window.apsanCloud || typeof window.apsanCloud.listen !== "function") return;
        try {
            await window.apsanCloud.ready();

            // Mensagens antigas e novas: a fonte é o Firebase, não apenas o cache
            // do aparelho onde o aluno abriu a página pela primeira vez.
            await window.apsanCloud.listen("appData/apsan_message_notifications", function (value) {
                if (value === null || value === undefined) return;
                const encoded = typeof value === "string" ? value : JSON.stringify(value);
                if (localStorage.getItem("apsan_message_notifications") !== encoded) {
                    localStorage.setItem("apsan_message_notifications", encoded);
                }
                updateBadge();
                renderPanel();
            });

            // Chamadas antigas e novas destinadas diretamente a este aluno.
            if (ROLE_BY_BODY === "aluno" && identity) {
                await window.apsanCloud.listen("appData/apsan_live_calls/" + identity, function (value) {
                    const map = value && typeof value === "object" ? value : {};
                    const current = read("apsan_live_notifications", []);
                    const arr = Array.isArray(current) ? current.slice() : [];

                    Object.keys(map).forEach(function (id) {
                        const call = map[id];
                        if (!call || !call.liveId) return;
                        const index = arr.findIndex(function (item) {
                            return item && item.liveId === call.liveId &&
                                normalizePhone(item.recipientPhone) === identity;
                        });
                        const item = Object.assign({}, call, {
                            recipientPhone: identity
                        });
                        if (index >= 0) arr[index] = Object.assign({}, arr[index], item);
                        else arr.push(item);

                        if (call.active !== false) {
                            const headers = notifications();
                            const hi = headers.findIndex(function (item) {
                                return item && item.recipientKey === recipientKey &&
                                    item.kind === "live-class" && item.liveId === call.liveId;
                            });
                            const previous = hi >= 0 ? headers[hi] : null;
                            const notification = {
                                id: "hn_live_" + call.liveId + "_" + identity,
                                recipientKey: recipientKey,
                                recipientType: "aluno",
                                title: "🔴 Aula ao vivo",
                                text: (call.teacherName || "Professor") + " iniciou " + (call.title || "uma aula") + " · toque para entrar.",
                                kind: "live-class",
                                link: call.joinUrl || ("quadro.html?live=" + encodeURIComponent(call.liveId)),
                                liveId: call.liveId,
                                signature: "Aula ao vivo · " + call.liveId,
                                createdAt: call.createdAt || (previous && previous.createdAt) || new Date().toISOString(),
                                readAt: previous ? (previous.readAt || null) : null,
                                deletedAt: previous ? (previous.deletedAt || null) : null
                            };
                            // Uma sincronização da chamada não transforma uma notificação
                            // já visualizada/eliminada em nova.
                            if (hi >= 0) headers[hi] = notification;
                            else headers.push(notification);
                            localStorage.setItem("apsan_header_notifications", JSON.stringify(headers.slice(-100)));
                        }
                    });

                    localStorage.setItem("apsan_live_notifications", JSON.stringify(arr.slice(-300)));
                    updateBadge();
                    renderPanel();
                    window.dispatchEvent(new CustomEvent("apsan-live-call", {detail:{source:"header-realtime"}}));
                });
            }
        } catch (error) {
            console.warn("APSAN notificações realtime:", error);
            setTimeout(bindCloudRealtime, 2000);
        }
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
            const action = event.target.closest("[data-notification-action]");
            const row = event.target.closest("[data-notification-id]");
            if (!action || !row) return;

            const id = row.getAttribute("data-notification-id") || "";
            const item = allVisibleNotifications().find(function (entry) {
                return String(entry.id || "") === id;
            });
            if (!item) return;

            const actionName = action.getAttribute("data-notification-action");
            if (actionName === "delete") {
                deleteNotification(item);
                return;
            }

            if (actionName === "view") {
                markNotificationRead(item);
                const link = item.link || "";
                closePanel();
                if (link === "mensagens.html" || /^https?:\/\//i.test(link)) {
                    window.location.href = link;
                    return;
                }
                if (link) window.location.hash = link.replace(/^#/, "");
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
        window.addEventListener("apsan-cloud-sync", function (event) {
            var key = event.detail && String(event.detail.key || "");
            if (key === "apsan_message_notifications" ||
                key === "apsan_header_notifications" ||
                key === "apsan_live_notifications" ||
                key === "apsan_messages") {
                checkForUpdates();
                updateBadge();
                renderPanel();
            }
        });
        window.addEventListener("apsan-live-call", function () {
            updateBadge();
            renderPanel();
        });

        updateBadge();
        forceHeaderBadgeSync();
        renderPanel();
        checkForUpdates();
        setInterval(function () {
            forceHeaderBadgeSync();
            checkForUpdates();
            updateBadge();
            renderPanel();
        }, 2500);
        bindCloudRealtime();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bind);
    } else {
        bind();
    }
})();