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
        "Educação & Futuro": "Education & Future"
    };

    function read() {
        try {
            const saved = JSON.parse(localStorage.getItem("apsan_app_settings") || "{}");
            return Object.assign({}, DEFAULTS, saved);
        } catch (e) {
            return Object.assign({}, DEFAULTS);
        }
    }

    function save(settings) {
        localStorage.setItem("apsan_app_settings", JSON.stringify(settings));
        apply(settings);
        window.dispatchEvent(new CustomEvent("apsan:settings-changed", { detail: settings }));
    }

    function applyWallpaper(name) {
        const wallpapers = [
            "default","soft-blue","deep-blue","minimal",
            "blue-wave","global-network","academic-night","study-space",
            "serene-nature","digital-aurora","clean-minimal","apsan-premium","library","creativity","global-education","education-future"
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
        reset: function () { save(DEFAULTS); }
    };

    document.addEventListener("DOMContentLoaded", function () {
        apply(read());
    });
})();