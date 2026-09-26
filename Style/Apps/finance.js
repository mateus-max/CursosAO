document.addEventListener("DOMContentLoaded", function () {
    "use strict";

    const FINANCE_PREFIX = "apsan_teacher_finance_";
    const WITHDRAWALS_KEY = "apsan_finance_withdrawals";

    function read(key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
            return Array.isArray(value) ? value : (value || fallback);
        } catch (error) {
            return fallback;
        }
    }

    function write(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function esc(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function digits(value) {
        return String(value || "").replace(/\D/g, "");
    }

    function phoneKey(value) {
        const d = digits(value);
        return d.length > 9 ? d.slice(-9) : d || "default";
    }

    function money(value) {
        const n = Number(value) || 0;
        return new Intl.NumberFormat("pt-AO", {
            maximumFractionDigits: 0
        }).format(n) + " Kz";
    }

    function moneyPlain(value) {
        return Math.round(Number(value) || 0);
    }

    function dateTime(value) {
        if (!value) return "—";
        try {
            return new Date(value).toLocaleString("pt-PT", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });
        } catch (error) {
            return String(value);
        }
    }

    function currentAccount() {
        try {
            const stored = JSON.parse(localStorage.getItem("apsan_account") || "null");
            if (stored && stored.type) return stored;
        } catch (error) {}
        const phone = localStorage.getItem("apsan_phone") || "";
        const type = localStorage.getItem("apsan_user_type") || "";
        const accounts = read("apsan_accounts", []);
        return accounts.find(function (item) {
            return item && (!phone || phoneKey(item.phone) === phoneKey(phone)) &&
                (!type || item.type === type);
        }) || null;
    }

    function financeKey(phone) {
        return FINANCE_PREFIX + phoneKey(phone);
    }

    function getLedger(phone) {
        return read(financeKey(phone), []);
    }

    function saveLedger(phone, ledger) {
        write(financeKey(phone), ledger);
    }

    function confirmedEnrollments() {
        return read("apsan_enrollments", []).filter(function (item) {
            return item &&
                item.status === "official" &&
                item.paymentStatus === "confirmed" &&
                item.teacherPhone;
        });
    }

    /*
     * Cada matrícula confirmada pela Direção origina uma única entrada
     * no livro do professor. O sourceId impede duplicações em cada atualização.
     */
    function syncConfirmedPayments() {
        const grouped = {};
        confirmedEnrollments().forEach(function (enrollment) {
            const key = phoneKey(enrollment.teacherPhone);
            grouped[key] = grouped[key] || [];
            grouped[key].push(enrollment);
        });

        Object.keys(grouped).forEach(function (key) {
            const teacherPhone = grouped[key][0].teacherPhone;
            const ledger = getLedger(teacherPhone);
            let changed = false;

            grouped[key].forEach(function (enrollment) {
                const sourceId = "payment:" + String(enrollment.id);
                const exists = ledger.some(function (entry) {
                    return entry && entry.sourceId === sourceId;
                });

                if (!exists) {
                    ledger.push({
                        id: "fin_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
                        sourceId: sourceId,
                        type: "entrada",
                        amount: moneyPlain(enrollment.price),
                        description: "Pagamento de " + (enrollment.studentName || "Aluno"),
                        course: enrollment.course || "Curso",
                        studentName: enrollment.studentName || "Aluno",
                        enrollmentId: enrollment.id,
                        createdAt: enrollment.confirmedAt || enrollment.updatedAt || enrollment.createdAt || new Date().toISOString()
                    });
                    changed = true;
                }
            });

            if (changed) saveLedger(teacherPhone, ledger);
        });
    }

    function calculate(ledger) {
        return ledger.reduce(function (result, entry) {
            const amount = moneyPlain(entry.amount);
            if (entry.type === "entrada") {
                result.income += amount;
                result.balance += amount;
            } else if (entry.type === "saida") {
                result.expense += amount;
                result.balance -= amount;
            }
            return result;
        }, { income: 0, expense: 0, balance: 0 });
    }

    function pendingForTeacher(phone) {
        return read(WITHDRAWALS_KEY, []).filter(function (item) {
            return item && item.teacherPhoneKey === phoneKey(phone) && item.status === "pending";
        });
    }

    function renderTeacherFinance() {
        const account = currentAccount();
        if (!account || account.type !== "professor") return;

        syncConfirmedPayments();

        const ledger = getLedger(account.phone);
        const totals = calculate(ledger);
        const pending = pendingForTeacher(account.phone);
        const pendingTotal = pending.reduce(function (sum, item) {
            return sum + moneyPlain(item.amount);
        }, 0);

        const cardName = document.getElementById("teacherCardName");
        const balance = document.getElementById("teacherFinanceBalance");
        const income = document.getElementById("teacherFinanceIncome");
        const expense = document.getElementById("teacherFinanceExpense");
        const pendingEl = document.getElementById("teacherFinancePending");
        const count = document.getElementById("teacherFinanceMovementCount");
        const list = document.getElementById("teacherFinanceTransactions");
        const last4 = document.getElementById("teacherCardLast4");

        if (cardName) cardName.textContent = account.name || "Professor";
        if (balance) balance.textContent = money(totals.balance);
        if (income) income.textContent = money(totals.income);
        if (expense) expense.textContent = money(totals.expense);
        if (pendingEl) pendingEl.textContent = money(pendingTotal);
        if (count) count.textContent = String(ledger.length);

        if (last4) {
            const raw = digits(account.phone);
            last4.textContent = (raw || "0000").slice(-4).padStart(4, "0");
        }

        if (list) {
            const rows = ledger.slice().sort(function (a, b) {
                return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
            }).slice(0, 12);

            list.innerHTML = rows.length ? rows.map(function (entry) {
                const incoming = entry.type === "entrada";
                return '<div class="teacher-finance-row">' +
                    '<div class="finance-row-icon ' + (incoming ? "income" : "expense") + '">' + (incoming ? "↑" : "↓") + '</div>' +
                    '<div class="finance-row-main"><strong>' + esc(entry.description || "Movimentação") + '</strong>' +
                    '<small>' + esc(entry.course || "Financeiro") + ' · ' + esc(dateTime(entry.createdAt)) + '</small></div>' +
                    '<strong class="finance-row-amount ' + (incoming ? "income" : "expense") + '">' +
                    (incoming ? "+" : "-") + money(entry.amount) + '</strong>' +
                    '</div>';
            }).join("") : '<p class="empty-state">Ainda não existem movimentações financeiras.</p>';
        }
    }

    function openWithdraw() {
        const modal = document.getElementById("teacherWithdrawModal");
        const form = document.getElementById("teacherWithdrawForm");
        const message = document.getElementById("teacherWithdrawMessage");
        const account = currentAccount();
        if (!modal || !account) return;

        if (form) form.reset();
        const holder = document.getElementById("withdrawHolder");
        if (holder) holder.value = account.name || "";
        if (message) message.textContent = "";
        modal.classList.add("finance-modal-open");
    }

    function closeWithdraw() {
        const modal = document.getElementById("teacherWithdrawModal");
        if (modal) modal.classList.remove("finance-modal-open");
    }

    const withdrawButton = document.getElementById("teacherWithdrawButton");
    if (withdrawButton) withdrawButton.addEventListener("click", openWithdraw);

    const closeWithdrawButton = document.getElementById("teacherWithdrawClose");
    if (closeWithdrawButton) closeWithdrawButton.addEventListener("click", closeWithdraw);

    const withdrawModal = document.getElementById("teacherWithdrawModal");
    if (withdrawModal) {
        withdrawModal.addEventListener("click", function (event) {
            if (event.target === withdrawModal) closeWithdraw();
        });
    }

    const withdrawForm = document.getElementById("teacherWithdrawForm");
    if (withdrawForm) {
        withdrawForm.addEventListener("submit", function (event) {
            event.preventDefault();

            const account = currentAccount();
            if (!account || account.type !== "professor") return;

            syncConfirmedPayments();
            const totals = calculate(getLedger(account.phone));
            const pendingTotal = pendingForTeacher(account.phone).reduce(function (sum, item) {
                return sum + moneyPlain(item.amount);
            }, 0);

            const amount = moneyPlain(document.getElementById("withdrawAmount").value);
            const bank = document.getElementById("withdrawBank").value.trim();
            const holder = document.getElementById("withdrawHolder").value.trim();
            const accountNumber = document.getElementById("withdrawAccount").value.trim();
            const iban = document.getElementById("withdrawIban").value.trim();
            const message = document.getElementById("teacherWithdrawMessage");

            if (!amount || amount <= 0 || !bank || !holder || !accountNumber || !iban) {
                message.textContent = "Preencha todos os dados do saque.";
                message.style.color = "#c62828";
                return;
            }

            if (amount > totals.balance - pendingTotal) {
                message.textContent = "O valor solicitado é superior ao saldo disponível para saque.";
                message.style.color = "#c62828";
                return;
            }

            const withdrawals = read(WITHDRAWALS_KEY, []);
            withdrawals.push({
                id: "wd_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
                teacherPhone: account.phone,
                teacherPhoneKey: phoneKey(account.phone),
                teacherName: account.name || "Professor",
                amount: amount,
                bank: bank,
                holder: holder,
                accountNumber: accountNumber,
                iban: iban,
                status: "pending",
                createdAt: new Date().toISOString()
            });
            write(WITHDRAWALS_KEY, withdrawals);

            message.textContent = "Pedido de saque enviado à Direção.";
            message.style.color = "#16803c";
            renderTeacherFinance();

            setTimeout(closeWithdraw, 900);
        });
    }

    const statementButton = document.getElementById("teacherStatementButton");
    if (statementButton) {
        statementButton.addEventListener("click", function () {
            const section = document.querySelector(".teacher-finance-transactions");
            if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }

    const refreshButton = document.getElementById("teacherFinanceRefresh");
    if (refreshButton) refreshButton.addEventListener("click", renderTeacherFinance);

    function renderAdminFinance() {
        const account = currentAccount();
        if (!account || account.type !== "direcao") return;

        syncConfirmedPayments();

        const accounts = read("apsan_accounts", []);
        const teachers = accounts.filter(function (item) {
            return item && item.type === "professor";
        });
        const withdrawals = read(WITHDRAWALS_KEY, []);
        const summary = document.getElementById("adminFinanceSummary");
        const list = document.getElementById("adminTeacherFinanceList");
        if (!summary || !list) return;

        let totalBalance = 0;
        let totalPending = 0;

        const teacherCards = teachers.map(function (teacher) {
            const ledger = getLedger(teacher.phone);
            const totals = calculate(ledger);
            const pending = withdrawals.filter(function (item) {
                return item.teacherPhoneKey === phoneKey(teacher.phone) && item.status === "pending";
            });
            totalBalance += totals.balance;
            totalPending += pending.reduce(function (sum, item) {
                return sum + moneyPlain(item.amount);
            }, 0);

            const recent = ledger.slice().sort(function (a, b) {
                return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
            }).slice(0, 3);

            return '<div class="admin-finance-teacher-card">' +
                '<div class="admin-finance-teacher-head">' +
                    '<div class="admin-row-avatar">' + esc((teacher.name || "P").charAt(0).toUpperCase()) + '</div>' +
                    '<div><strong>' + esc(teacher.name || "Professor") + '</strong><small>' + esc(teacher.phone || "") + '</small></div>' +
                    '<strong class="admin-finance-balance">' + money(totals.balance) + '</strong>' +
                '</div>' +
                '<div class="admin-finance-mini-grid">' +
                    '<span><small>Entradas</small><strong>' + money(totals.income) + '</strong></span>' +
                    '<span><small>Saídas</small><strong>' + money(totals.expense) + '</strong></span>' +
                    '<span><small>Saques pendentes</small><strong>' + money(pending.reduce(function (s, x) { return s + moneyPlain(x.amount); }, 0)) + '</strong></span>' +
                '</div>' +
                '<div class="admin-finance-recent">' +
                    (recent.length ? recent.map(function (entry) {
                        return '<div><span>' + esc(entry.description) + '</span><strong>' + (entry.type === "entrada" ? "+" : "-") + money(entry.amount) + '</strong></div>';
                    }).join("") : '<small>Nenhuma movimentação ainda.</small>') +
                '</div>' +
                '</div>';
        });

        summary.innerHTML =
            '<div><small>Saldo total dos professores</small><strong>' + money(totalBalance) + '</strong></div>' +
            '<div><small>Saques pendentes</small><strong>' + money(totalPending) + '</strong></div>' +
            '<div><small>Professores</small><strong>' + teachers.length + '</strong></div>';

        const pendingRows = withdrawals.filter(function (item) {
            return item.status === "pending";
        }).map(function (item) {
            return '<div class="admin-finance-withdrawal">' +
                '<div><strong>' + esc(item.teacherName) + '</strong><small>' + esc(item.bank) + ' · ' + esc(item.holder) + ' · ' + esc(item.iban) + '</small></div>' +
                '<strong>' + money(item.amount) + '</strong>' +
                '<div class="admin-actions">' +
                    '<button type="button" class="admin-action approve" data-finance-approve="' + esc(item.id) + '">Aprovar saque</button>' +
                    '<button type="button" class="admin-action reject" data-finance-reject="' + esc(item.id) + '">Rejeitar</button>' +
                '</div>' +
            '</div>';
        }).join("");

        list.innerHTML =
            '<div class="admin-finance-withdrawals"><div class="admin-panel-title"><h3>Pedidos de saque</h3><span>' + pendingRows.split('<div class="admin-finance-withdrawal">').length - 1 + ' pendentes</span></div>' +
            (pendingRows || '<p class="admin-empty">Não existem pedidos de saque pendentes.</p>') +
            '</div>' +
            '<div class="admin-finance-teachers"><div class="admin-panel-title"><h3>Carteiras dos professores</h3><span>Atualização automática após confirmação do pagamento</span></div>' +
            (teacherCards.join("") || '<p class="admin-empty">Nenhum professor registado.</p>') +
            '</div>';
    }

    function approveWithdrawal(id) {
        const account = currentAccount();
        if (!account || account.type !== "direcao") return;

        const withdrawals = read(WITHDRAWALS_KEY, []);
        const index = withdrawals.findIndex(function (item) {
            return String(item.id) === String(id) && item.status === "pending";
        });
        if (index < 0) return;

        const request = withdrawals[index];
        const ledger = getLedger(request.teacherPhone);
        const totals = calculate(ledger);
        const pendingOther = withdrawals.filter(function (item, i) {
            return i !== index && item.teacherPhoneKey === request.teacherPhoneKey && item.status === "pending";
        }).reduce(function (sum, item) {
            return sum + moneyPlain(item.amount);
        }, 0);

        if (moneyPlain(request.amount) > totals.balance - pendingOther) {
            alert("O saldo disponível deste professor já não permite este saque.");
            return;
        }

        ledger.push({
            id: "fin_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
            sourceId: "withdrawal:" + request.id,
            type: "saida",
            amount: moneyPlain(request.amount),
            description: "Saque aprovado",
            category: "Saque",
            bank: request.bank,
            holder: request.holder,
            createdAt: new Date().toISOString()
        });
        saveLedger(request.teacherPhone, ledger);

        withdrawals[index].status = "approved";
        withdrawals[index].approvedAt = new Date().toISOString();
        write(WITHDRAWALS_KEY, withdrawals);
        renderAdminFinance();
    }

    function rejectWithdrawal(id) {
        const account = currentAccount();
        if (!account || account.type !== "direcao") return;
        const withdrawals = read(WITHDRAWALS_KEY, []);
        const index = withdrawals.findIndex(function (item) {
            return String(item.id) === String(id) && item.status === "pending";
        });
        if (index < 0) return;
        const reason = prompt("Motivo da rejeição (opcional):", "Pedido de saque não aprovado.");
        withdrawals[index].status = "rejected";
        withdrawals[index].rejectionReason = reason || "";
        withdrawals[index].rejectedAt = new Date().toISOString();
        write(WITHDRAWALS_KEY, withdrawals);
        renderAdminFinance();
    }

    document.addEventListener("click", function (event) {
        const approve = event.target.closest("[data-finance-approve]");
        if (approve) {
            approveWithdrawal(approve.getAttribute("data-finance-approve"));
            return;
        }
        const reject = event.target.closest("[data-finance-reject]");
        if (reject) {
            rejectWithdrawal(reject.getAttribute("data-finance-reject"));
        }
    });

    window.addEventListener("storage", function (event) {
        if (
            event.key === "apsan_enrollments" ||
            event.key === "apsan_finance_withdrawals" ||
            (event.key && event.key.indexOf(FINANCE_PREFIX) === 0)
        ) {
            renderTeacherFinance();
            renderAdminFinance();
        }
    });

    syncConfirmedPayments();
    renderTeacherFinance();
    renderAdminFinance();

    setInterval(function () {
        syncConfirmedPayments();
        renderTeacherFinance();
        renderAdminFinance();
    }, 3000);
});