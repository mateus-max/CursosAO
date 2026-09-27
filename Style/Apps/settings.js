/* APSAN Academy — preferências globais do aplicativo */
(function () {
    "use strict";

    const DEFAULTS = {
        language: "pt",
        wallpaper: "default"
    };

    const translations = {
        "Início": "Home",
        "Pesquisar professores": "Search teachers",
        "Meus cursos": "My courses",
        "Minhas matrículas": "My enrollments",
        "Aulas": "Lessons",
        "Materiais": "Materials",
        "Minha agenda": "My schedule",
        "Meu progresso": "My progress",
        "Mensagens": "Messages",
        "Notificações": "Notifications",
        "Pagamentos": "Payments",
        "Meu perfil": "My profile",
        "Configurações": "Settings",
        "Sair da conta": "Sign out",
        "Área do aluno": "Student area",
        "Área do professor": "Teacher area",
        "Meu Perfil": "My Profile",
        "Minhas matrículas": "My enrollments",
        "ACOMPANHAMENTO": "OVERVIEW",
        "ACESSO RÁPIDO": "QUICK ACCESS",
        "Continue a aprender": "Keep learning",
        "Ver cursos": "View courses",
        "Ver aulas": "View lessons",
        "Ver materiais": "View materials",
        "Curso": "Course",
        "Professor": "Teacher",
        "Mensalidade": "Monthly fee",
        "Matrícula confirmada": "Enrollment confirmed",
        "Aguardando confirmação": "Awaiting confirmation",
        "Configurações do aplicativo": "App settings",
        "Idioma": "Language",
        "Português": "Portuguese",
        "Inglês": "English",
        "Papel de parede": "Wallpaper",
        "Fundo padrão": "Default background",
        "Azul suave": "Soft blue",
        "Azul profundo": "Deep blue",
        "Minimalista": "Minimal",
        "Guardar alterações": "Save changes",
        "Aplicado automaticamente": "Applied automatically",
        "Fechar": "Close",
        "Salvar alterações": "Save changes",
        "Onda Azul": "Blue Wave",
        "Rede Global": "Global Network",
        "Noite Académica": "Academic Night",
        "Espaço de Estudos": "Study Space",
        "Natureza Serena": "Serene Nature",
        "Aurora Digital": "Digital Aurora",
        "Minimalista Claro": "Clean Minimal",
        "APSAN Premium": "APSAN Premium",
        "Padrão APSAN": "APSAN Default",
        "Estudo Moderno": "Modern Study",
        "Tecnologia & Conexão": "Technology & Connection",
        "Biblioteca": "Library",
        "Criatividade": "Creativity",
        "Global Education": "Global Education",
        "Educação & Futuro": "Education & Future",
        "Configurações": "Settings",
        "Controlo geral da plataforma": "General platform control",
        "Utilizadores": "Users",
        "Professores": "Teachers",
        "Alunos": "Students",
        "Cursos": "Courses",
        "Matrículas": "Enrollments",
        "Pagamentos": "Payments",
        "Financeiro": "Finance",
        "Moderação": "Moderation",
        "Ocorrências": "Incidents",
        "Relatórios": "Reports",
        "Aprovação de perfis": "Profile approval",
        "Aprovação de cursos": "Course approval",
        "Estado da plataforma": "Platform status",
        "Manual pela Direção": "Manual by Direction",
        "Automática": "Automatic",
        "Ativa": "Active",
        "Manutenção": "Maintenance",
        "Guardar configurações": "Save settings",
        "Configurações guardadas.": "Settings saved successfully.",
        "Idioma": "Language",
        "Escolha o idioma deste painel da Direção.": "Choose the language for this Direction panel.",
        "Papel de parede": "Wallpaper",
        "A preferência é exclusiva da Direção e não altera o fundo dos alunos ou professores.": "This preference belongs only to the Direction and does not change student or teacher backgrounds.",
        "Padrão APSAN": "APSAN Default",
        "Editar perfil": "Edit profile",
        "Ver perfil": "View profile",
        "Observar": "View",
        "Aprovar": "Approve",
        "Rejeitar": "Reject",
        "Curso publicado": "Published course",
        "Pagamentos confirmados": "Confirmed payments",
        "Pagamento confirmado": "Payment confirmed",
        "Aguardando confirmação": "Awaiting confirmation",
        "Pagamento rejeitado": "Payment rejected",
        "Aula Virtual": "Virtual Class",
        "Estudo em Grupo": "Group Study",
        "Sala Digital": "Digital Classroom",
        "Leitura & Aprendizagem": "Reading & Learning",
        "Informática Educativa": "Educational Computing",
        "Biblioteca & Conhecimento": "Library & Knowledge",
        "Tecnologia na Educação": "Technology in Education",
        "Cursos Online": "Online Courses",
        "Estudo Virtual": "Virtual Study",
        "Aula ao Vivo": "Live Class"
    };

    /*
     * As preferências visuais pertencem à conta/perfil autenticado.
     * Não usamos uma única chave global, porque isso faria a escolha de
     * um aluno/professor aparecer nos outros perfis no mesmo navegador.
     */
    function getProfileScope() {
        let account = null;
        try {
            account = JSON.parse(localStorage.getItem("apsan_account") || "null");
        } catch (e) {
            account = null;
        }

        const type =
            localStorage.getItem("apsan_user_type") ||
            (document.body.classList.contains("professor-page") ? "professor" :
             document.body.classList.contains("student-page") ? "aluno" :
             document.body.classList.contains("admin-page") ? "direcao" : "guest");

        const identity =
            localStorage.getItem("apsan_phone") ||
            (account && (account.phone || account.email || account.username || account.id)) ||
            type;

        const safeIdentity = String(identity || type)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9._@+-]+/g, "_");

        return "apsan_app_settings_v2_" + type + "_" + safeIdentity;
    }

    function read() {
        const profileKey = getProfileScope();

        try {
            const saved = JSON.parse(localStorage.getItem(profileKey) || "null");

            if (saved && typeof saved === "object") {
                return Object.assign({}, DEFAULTS, saved);
            }

            /*
             * Migração única e segura: a antiga preferência global é atribuída
             * somente ao perfil que está atualmente autenticado. Depois disso,
             * cada perfil passa a ter a sua própria preferência.
             */
            const legacy = JSON.parse(localStorage.getItem("apsan_app_settings") || "null");
            if (legacy && typeof legacy === "object") {
                localStorage.setItem(profileKey, JSON.stringify(Object.assign({}, DEFAULTS, legacy)));
                localStorage.removeItem("apsan_app_settings");
                return Object.assign({}, DEFAULTS, legacy);
            }
        } catch (e) {
            /* Se houver dados inválidos, começa com as preferências padrão. */
        }

        return Object.assign({}, DEFAULTS);
    }

    function save(settings) {
        const profileSettings = Object.assign({}, DEFAULTS, settings || {});
        localStorage.setItem(getProfileScope(), JSON.stringify(profileSettings));
        apply(profileSettings);
        window.dispatchEvent(new CustomEvent("apsan:settings-changed", { detail: profileSettings }));
    }

    function applyWallpaper(name) {
        const wallpapers = [
            "default","soft-blue","deep-blue","minimal",
            "blue-wave","global-network","academic-night","study-space",
            "serene-nature","digital-aurora","clean-minimal","apsan-premium","library","creativity","global-education","education-future",
        "virtual-class","study-together","digital-classroom","reading-class","computer-learning","learning-library","education-tech","online-course","virtual-study","live-class"
        ];
        document.body.classList.remove.apply(document.body.classList, wallpapers.map(function (item) {
            return "apsan-wallpaper-" + item;
        }));
        document.body.classList.add("apsan-wallpaper-" + (wallpapers.indexOf(name) >= 0 ? name : "default"));
    }

    function translateTree(root, language) {
        if (!root || language !== "en") return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        let node;
        while ((node = walker.nextNode())) nodes.push(node);
        nodes.forEach(function (textNode) {
            const value = textNode.nodeValue.trim();
            if (!value || !translations[value]) return;
            textNode.nodeValue = textNode.nodeValue.replace(value, translations[value]);
        });
        root.querySelectorAll("input[placeholder], textarea[placeholder]").forEach(function (el) {
            const value = el.getAttribute("placeholder");
            if (translations[value]) el.setAttribute("placeholder", translations[value]);
        });
    }

    function apply(settings) {
        const current = Object.assign({}, DEFAULTS, settings || {});
        document.documentElement.lang = current.language === "en" ? "en" : "pt";
        document.body.dataset.appLanguage = current.language;
        applyWallpaper(current.wallpaper);

        if (current.language === "en") {
            translateTree(document.body, "en");
        }
    }

    window.APSANSettings = {
        get: read,
        save: save,
        apply: apply,
        reset: function () { save(DEFAULTS); },
        getScopeKey: getProfileScope
    };

    document.addEventListener("DOMContentLoaded", function () {
        apply(read());
    });
})();