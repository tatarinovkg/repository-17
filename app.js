const tg = window.Telegram ? window.Telegram.WebApp : null;
    const apiBaseUrl = 'https://api.s.tkgn.ru/api/';
    const MOCK_MODE = false; // переключить на true для офлайн-тестов
    const mockData = {
        groups: [
            { id: 1, name: '💼 Корпоративные сервисы' },
            { id: 2, name: '⚙️ Техническая поддержка' },
            { id: 3, name: '🧾 Документы и заявки' },
        ],
        services: {
            1: [
                { id: 101, serviceName: 'VPN доступ', providerName: 'IT Security', shortDescription: 'Настройка удаленного доступа' },
                { id: 102, serviceName: 'Почтовый ящик', providerName: 'IT Ops', shortDescription: 'Создание и настройка корпоративной почты' },
            ],
            2: [
                { id: 201, serviceName: 'Срочная заявка', providerName: 'Служба поддержки', shortDescription: 'Высокий приоритет' },
                { id: 202, serviceName: 'Плановая заявка', providerName: 'Служба поддержки', shortDescription: 'Стандартный приоритет' },
            ],
            3: [
                { id: 301, serviceName: 'Справка о доходах', providerName: 'HR', shortDescription: 'Получить за 5 минут' },
            ],
        },
        serviceDetails: {
            101: { id: 101, serviceName: 'VPN доступ', contactPerson: 'Алексей', contacts: '+7 900 000-00-01', service: 'Шаги подключения:\n1) Подать заявку\n2) Установить клиент\n3) Подключиться' },
            102: { id: 102, serviceName: 'Почтовый ящик', contactPerson: 'Светлана', contacts: '+7 900 000-00-02', service: 'Создадим корпоративный ящик, настроим подпись и права' },
            201: { id: 201, serviceName: 'Срочная заявка', contactPerson: 'Дежурная смена', contacts: '+7 900 000-00-03', service: 'Заявки с высоким приоритетом. Реакция до 15 минут.' },
            202: { id: 202, serviceName: 'Плановая заявка', contactPerson: 'Служба поддержки', contacts: '+7 900 000-00-04', service: 'Регулярные задачи. Реакция до 2 часов.' },
            301: { id: 301, serviceName: 'Справка о доходах', contactPerson: 'HR', contacts: '+7 900 000-00-05', service: 'Автоматическая выдача справки в PDF' },
        },
        feedbacks: {
            101: [
                { usersName: 'Ирина', feedbackRating: 5, feedbackText: 'Подключили за 10 минут' },
                { usersName: 'Павел', feedbackRating: 4, feedbackText: 'Все работает' },
            ],
        },
        orgGroups: [
            { id: 11, name: '🏥 Медицинские учреждения' },
            { id: 12, name: '🏛 Муниципальные организации' },
        ],
        organisations: {
            11: [
                { id: 501, name: 'Клиника «Здоровье»', address: 'г. Тюмень, ул. Центральная 10', contacts: '+7 900 111-11-11' },
                { id: 502, name: 'Городская больница №2', address: 'г. Тюмень, ул. Ленина 5', contacts: '+7 900 222-22-22' },
            ],
            12: [
                { id: 601, name: 'МФЦ Тюмень', address: 'ул. Республики 50', contacts: '+7 900 333-33-33' },
            ],
        },
        organisationDetails: {
            501: { id: 501, group_id: 11, name: 'Клиника «Здоровье»', address: 'г. Тюмень, ул. Центральная 10', contacts: '+7 900 111-11-11' },
            502: { id: 502, group_id: 11, name: 'Городская больница №2', address: 'г. Тюмень, ул. Ленина 5', contacts: '+7 900 222-22-22' },
            601: { id: 601, group_id: 12, name: 'МФЦ Тюмень', address: 'ул. Республики 50', contacts: '+7 900 333-33-33' },
        }
    };

    function initTelegramApp(){
        if (!tg) return;
        try{
            tg.ready(); tg.expand();
            applyTelegramTheme();
            tg.onEvent('themeChanged', applyTelegramTheme);
        }catch(e){ console.warn('TG init error', e); }
    }

    function applyTelegramTheme(){
        if (!tg) return;
        const override = localStorage.getItem('themeOverride');
        if (override !== 'user') {
            const isDark = tg.colorScheme === 'dark';
            document.documentElement.classList.toggle('dark', isDark);
        }
        const tp = tg.themeParams || {}; const css = document.documentElement.style;
        if (tp.bg_color) css.setProperty('--app-bg', tp.bg_color);
        if (tp.text_color) css.setProperty('--app-fg', tp.text_color);
        if (tp.secondary_bg_color) css.setProperty('--dd-bg', tp.secondary_bg_color);
        updateThemeIcon();
    }
    function haptic(type='impact', style='light'){
        try{ if(!tg?.HapticFeedback) return; if(type==='impact') tg.HapticFeedback.impactOccurred(style); if(type==='success') tg.HapticFeedback.notificationOccurred('success'); if(type==='error') tg.HapticFeedback.notificationOccurred('error'); }catch{}
    }

    let groupsCache=null, groupsLoading=null; // грузим только при входе на root
    const servicesCache=new Map(); // per group
    const serviceDetailsCache=new Map();
    const feedbacksCache=new Map();
    const groupNameCache = new Map(); // groupId -> name

    let orgGroupsCache=null, orgGroupsLoading=null;
    const orgGroupNameCache = new Map(); // orgGroupId -> name
    const orgListsCache = new Map(); // orgGroupId -> list of organisations
    const orgDetailsCache = new Map(); // organisationId -> details

    const analyticsClientId = ensureAnalyticsClientId();
    let analyticsToken = loadAdminToken();
    let analyticsTokenExp = loadAdminTokenExp();
    let adminUnlocked = isAdminTokenValid();

    let deepLinkForceHome = false;

    document.addEventListener('DOMContentLoaded', () => {
        fastThemeBoot(); initTelegramApp();
        bindHeader();
        initTitleMarquee();
        window.addEventListener('hashchange', routeFromHash);
        showInitialLoading();
        waitMaintenanceThenStart();
    });

    let orgSecretCount = 0;
    let orgSecretTimer = null;
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-mode="orgs"]');
        if (btn) handleOrgSecretTap();
    });

    function handleOrgSecretTap(){
        if (isAdminTokenValid()) return;
        orgSecretCount += 1;
        if (orgSecretTimer) clearTimeout(orgSecretTimer);
        orgSecretTimer = setTimeout(() => { orgSecretCount = 0; }, 5000);
        if (orgSecretCount >= 10){
            orgSecretCount = 0;
            showAdminLoginModal();
        }
    }
    function fastThemeBoot(){
        try{
            const override = localStorage.getItem('themeOverride'); // 'user' | null
            const saved = localStorage.getItem('theme');            // 'dark' | 'light' | null
            if (override === 'user' && saved) {
                document.documentElement.classList.toggle('dark', saved === 'dark');
            } else {
                const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                document.documentElement.classList.toggle('dark', isDark);
            }
            updateThemeIcon();
        }catch{}
    }
    function bindHeader(){
        document.getElementById('openSearch').onclick = ()=> { updateHash({ view: 'search', q: '' }); };
        const statsBtn = document.getElementById('openStats');
        if (statsBtn) statsBtn.onclick = ()=> { if (ensureAdminAccess()) { updateHash({ view:'stats' }); haptic('impact'); } };
        updateAdminUi();
        document.getElementById('themeToggle').onclick = ()=> { toggleTheme(); haptic('impact'); };
        const backBtn = document.getElementById('navBack');
        if (backBtn) backBtn.onclick = ()=> goBackSafe();
    }

    function showInitialLoading(){
        setTitle('Все услуги и организации');
        setHeaderActionsForRoot(false);
        setBackVisible(false);
        screen().innerHTML = pageLoading('Загружаем данные...');
    }

    function waitMaintenanceThenStart(){
        const getState = () => window.maintenanceState?.status || 'pending';

        const startOnce = (()=>{ let done=false; return ()=>{ 
            if(done) return; 
            if (getState() !== 'ok') return;
            done=true; 
            setTitle('Все услуги'); 
            routeFromEntry(); 
        }; })();

        const ready = window.maintenanceReady;
        if (ready && typeof ready.then === 'function') {
            ready.then(()=> { startOnce(); })
                 .catch(()=> setTitle('Все услуги и организации'));
        }

        window.addEventListener('maintenance:ok', () => { startOnce(); });
        window.addEventListener('maintenance:error', () => { setTitle('Все услуги и организации'); });
        window.addEventListener('maintenance:active', () => { setTitle('Все услуги и организации'); });
    }

    function updateThemeIcon(){
        const isDark=document.documentElement.classList.contains('dark');
        document.getElementById('themeIcon').textContent = isDark? '☀️':'🌙';
    }
    function toggleTheme(){
        const isDark = !document.documentElement.classList.contains('dark');
        document.documentElement.classList.toggle('dark', isDark);
        try{
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            localStorage.setItem('themeOverride', 'user');
        }catch{}
        updateThemeIcon();
    }

    function routeFromEntry(){
        const sp = new URLSearchParams(location.search);
        const sid = sp.get('serviceId');
        if (sid && /^\d+$/.test(sid)) {
            setHeaderActionsForRoot(false);
            setBackVisible(true);
            deepLinkForceHome = true;
            showServiceScreen(Number(sid));
            return;
        }
        try {
            const startParam = tg?.initDataUnsafe?.start_param;
            const m = startParam?.match(/(\d{2,})/);
            if (m) {
                setHeaderActionsForRoot(false);
                setBackVisible(true);
                deepLinkForceHome = true;
                showServiceScreen(Number(m[1]));
                return;
            }
        } catch {}
        routeFromHash();
    }


    function routeFromHash(){
        const p = new URLSearchParams(location.hash.replace(/^#/, ''));
        const view = p.get('view') || 'groups';
        const groupId = p.get('group') || null;
        const serviceId = p.get('service') || null;
        const orgGroupId = p.get('orgGroup') || null;
        const orgId = p.get('org') || null;
        const q = p.get('q') || '';

        const isRoot = ((view === 'groups' || view === 'org-groups') && !groupId && !serviceId && !orgGroupId && !orgId && !q);

        setHeaderActionsForRoot(isRoot);

        setBackVisible(!isRoot);

        if (view === 'stats')   { showAnalyticsScreen(); return; }
        if (view === 'search') { showSearchScreen(q); return; }
        if (serviceId)         { showServiceScreen(serviceId); return; }
        if (groupId)           { showGroupScreen(groupId); return; }
        if (orgId)             { showOrganisationScreen(orgId, orgGroupId); return; }
        if (orgGroupId)        { showOrgGroupScreen(orgGroupId); return; }
        if (view === 'org-groups') { showOrgGroupsScreen(); return; }
        showGroupsScreen();
    }



    function isRootFromHash(){
        const p = new URLSearchParams(location.hash.replace(/^#/, ''));
        const view = p.get('view') || 'groups';
        const group = p.get('group');
        const service = p.get('service');
        const orgGroup = p.get('orgGroup');
        const org = p.get('org');
        const q = p.get('q');
        return ((view === 'groups' || view === 'org-groups') && !group && !service && !orgGroup && !org && !q);
    }


    function updateNavForRoute(){
        const root = isRootFromHash();
        setBackVisible(!root);

        if (!tg) return;
        try {
            if (root) {
                tg.MainButton.setParams({ text: 'Закрыть приложение', is_visible: true });
                tg.MainButton.onClick(() => tg.close());
                tg.MainButton.show();
            } else {
                tg.MainButton.hide();
            }
        } catch(e){ console.warn('MainButton error', e); }
    }

    function updateHash(partial, replace=false){
        const p=new URLSearchParams(location.hash.replace(/^#/,''));
        Object.entries(partial).forEach(([k,v])=>{ if(v===undefined||v===null||v==='') p.delete(k); else p.set(k,v); });
        const next='#'+p.toString(); if(replace) { if(location.hash!==next) history.replaceState(null,'',next); } else { if(location.hash!==next) location.hash=next; }
    }

    const screen = () => document.getElementById('screen');
    function setTitle(text){
        const wrap = document.getElementById('appTitleWrap');
        const h1   = document.getElementById('appTitle');
        const span = document.getElementById('appTitleText');
        if (!wrap || !h1 || !span) return;

        const finalText = text || 'Услуги';
        span.textContent = finalText;
        h1.setAttribute('title', finalText);


        refreshTitleMarquee();
    }

    const TITLE_SPEED = 40;       // пикселей в секунду
    const TITLE_PAUSE = 1.2;      // чуть больше пауза на краях

    function refreshTitleMarquee(){
        const wrap = document.getElementById('appTitleWrap');
        const span = document.getElementById('appTitleText');
        const h1   = document.getElementById('appTitle');
        if (!wrap || !span || !h1) return;

        wrap.classList.remove('scrolling');

        if (span.scrollWidth <= wrap.clientWidth + 4) return; // помещается, не крутим

        const shift = wrap.clientWidth - span.scrollWidth - 8; // расстояние с зазором
        const distance = Math.abs(shift);

        const travelTime = distance / TITLE_SPEED;       // чистое время движения
        const totalTime = travelTime + TITLE_PAUSE * 2;  // + пауза на старте и конце

        h1.style.setProperty('--marquee-shift', shift + 'px');
        h1.style.setProperty('--marquee-duration', totalTime + 's');

        void wrap.offsetWidth; // перезапуск анимации
        wrap.classList.add('scrolling');
    }

    function initTitleMarquee(){
        const ro = new ResizeObserver(() => refreshTitleMarquee());
        const wrap = document.getElementById('appTitleWrap');
        const span = document.getElementById('appTitleText');
        if (wrap) ro.observe(wrap);
        if (span) ro.observe(span);
        window.addEventListener('orientationchange', refreshTitleMarquee);
        window.addEventListener('resize', refreshTitleMarquee);
    }

    function setBackVisible(v){
        const btn = document.getElementById('navBack');
        if (!btn) return;
        if (v) {
            btn.classList.remove('hidden');
            btn.style.display = 'inline-flex';
        } else {
            btn.classList.add('hidden');
            btn.style.display = 'none';
        }
    }

    function setHeaderActionsForRoot(isRoot) {
        const searchBtn = document.getElementById('openSearch');
        const themeBtn  = document.getElementById('themeToggle');
        const statsBtn  = document.getElementById('openStats');

        [searchBtn, themeBtn, statsBtn].forEach(el => {
            if (!el) return;
            const allow = isRoot && (el !== statsBtn || isAdminTokenValid());
            if (allow) {
                el.classList.remove('hidden');
                el.style.display = 'inline-flex';
                el.setAttribute('aria-hidden', 'false');
                el.tabIndex = 0;
            } else {
                el.classList.add('hidden');
                el.style.display = 'none';
                el.setAttribute('aria-hidden', 'true');
                el.tabIndex = -1;
            }
        });
    }


    function goBackSafe(){
        const before = location.href;
        history.back();
        setTimeout(() => {
            if (location.href === before) {
                history.replaceState(null, '', location.pathname + location.search);
                showGroupsScreen();
                routeFromHash();
            }
        }, 120);
    }



    async function showGroupsScreen(){
        setTitle('Все услуги');                 // updateNavForRoute уже вызван роутером
        deepLinkForceHome = false;
        if(!groupsCache){
            mountWithMode(pageLoading('Загружаем группы...'), 'services', true);
            await fetchGroups();
        }
        if(!groupsCache) return;
        renderGroups(groupsCache||[]);
        sendAnalyticsEvent('view', { view:'groups', metadata:{groups:(groupsCache||[]).length||0} });
        ensureHeaderVisible && ensureHeaderVisible();
    }

    async function fetchGroups(){
        if (MOCK_MODE) {
            groupsCache = mockData.groups;
            return groupsCache;
        }
        if(groupsCache || groupsLoading) { await groupsLoading; return groupsCache; }
        groupsLoading = (async()=>{
            try{
                const r = await fetch(apiBaseUrl + 'groups', { method:'POST', headers:{'Content-Type':'application/json'} });
                if(!r.ok) throw new Error('Bad response'); groupsCache = await r.json();
            }catch(e){ mountWithMode(pageError('Не удалось загрузить группы.'), 'services'); console.error(e); return null; }
            finally{ groupsLoading=null; }
        })();
        await groupsLoading; return groupsCache;
    }
    function renderGroups(groups){
        if(!groups?.length){
            mountWithMode(emptyState('Группы не найдены','Попробуйте позже.'), 'services', true);
            return;
        }
        const wrapper = document.createElement('div');
        wrapper.className = 'grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

        groups.forEach(g => {
            const gid  = getGroupId(g);
            const raw  = getGroupName(g) || '';
            if (gid && raw) groupNameCache.set(String(gid), String(raw));

            const { label, emoji } = extractGroupLabelAndEmoji ? extractGroupLabelAndEmoji(raw) : { label: raw, emoji: '' };

            const card = document.createElement('button');
            card.type = 'button';
            card.className = [
                'svc-card grp-watermark group w-full text-left',
                'rounded-2xl border border-slate-200 dark:border-slate-800',
                'bg-white/95 dark:bg-slate-900/95',
                'px-4 py-4 md:px-4 md:py-4',
                'transition duration-150 ease-out',
                'focus:outline-none focus:ring-2 focus:ring-brand'
            ].join(' ');
            card.setAttribute('data-emoji', emoji || '');

            card.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="min-w-0 flex-1">
          <div class="text-base md:text-[1.05rem] font-semibold leading-snug text-brand break-anywhere">
            ${escapeHTML(label)}
          </div>
        </div>
        <div class="row-chevron svc-chevron shrink-0 opacity-60 transition-transform">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
               class="text-slate-400 dark:text-slate-400">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>
      </div>
    `;

            card.onclick = () => { updateHash({ view:'group', group: gid }); haptic('impact'); };
            wrapper.appendChild(card);
        });

        mountWithMode(wrapper, 'services', true);
    }

    function extractGroupLabelAndEmoji(input){
        const s = String(input || '').trim();

        const EMOJI_COMPONENT = '(?:[\\u{1F3FB}-\\u{1F3FF}])?';        // модификаторы кожи
        const VS16 = '\\uFE0F?';                                       // вариационный селектор
        const ZWJ = '\\u200D';                                         // zero-width joiner
        const EMOJI_CORE =
            '(?:' +
            '[\\u{1F1E6}-\\u{1F1FF}]{2}' +                // флаги
            '|' +
            '[\\u{1F600}-\\u{1F64F}]' +                   // смайлики
            '|' +
            '[\\u{1F300}-\\u{1F5FF}]' +                   // символы/пиктограммы
            '|' +
            '[\\u{1F680}-\\u{1F6FF}]' +                   // транспорт
            '|' +
            '[\\u{2600}-\\u{26FF}]' +                     // разное
            '|' +
            '[\\u{2700}-\\u{27BF}]' +                     // дингбаты
            '|' +
            '[\\u{1F900}-\\u{1F9FF}]' +                   // расширенные эмодзи
            '|' +
            '[\\u{1FA70}-\\u{1FAFF}]' +                   // доп. эмодзи
            ')';

        const EMOJI_SEQ = `${EMOJI_CORE}${VS16}${EMOJI_COMPONENT}(?:${ZWJ}${EMOJI_CORE}${VS16}${EMOJI_COMPONENT})*`;
        const emojiRe = new RegExp(EMOJI_SEQ, 'gu');

        const emojis = Array.from(s.matchAll(emojiRe));
        const emoji = emojis.length ? emojis[0][0] : '';
        const label = s.replace(emojiRe, '').trim().replace(/[,\s]+$/, '') || s;

        return { label, emoji };
    }

    async function showGroupScreen(groupId){
        const cached = groupNameCache.get(String(groupId));
        if (cached) {
            setTitleInstant(cached);
        } else {
            setTitleLoadingPlaceholder();
        }

        mountWithMode(pageLoading('Загрузка услуг...'), 'services', false);

        resolveGroupName(groupId).then(name => {
            if (name && name !== cached) setTitleInstant(name);
        });

        const services = await fetchServices(groupId);
        if (services === null) return;
        renderServices(services, groupId);
        sendAnalyticsEvent('view', { view:'group', entityType:'group', entityId:groupId, metadata:{services:Array.isArray(services)?services.length:(services?.items?.length||0)} });

        ensureHeaderVisible && ensureHeaderVisible();
    }


    async function fetchServices(groupId){
        if(servicesCache.has(groupId)) return servicesCache.get(groupId);
        if (MOCK_MODE) {
            const data = mockData.services[groupId] || mockData.services[Number(groupId)] || [];
            servicesCache.set(groupId, data);
            return data;
        }
        try{
            const r = await fetch(`${apiBaseUrl}services/${groupId}`, { method:'POST', headers:{'Content-Type':'application/json'} });
            if(!r.ok) throw new Error('Ошибка при загрузке услуг');
            const data = await r.json(); servicesCache.set(groupId, data); return data;
        }catch(e){ mountWithMode(pageError('Ошибка при загрузке услуг.'), 'services'); console.error(e); return null; }
    }

    function renderServices(services, groupId){
        const items = Array.isArray(services) ? services : (services?.items || []);
        if (!items.length) { mountWithMode(emptyState('В этой группе нет услуг','Попробуйте другую группу.'), 'services', false); return; }

        const grid = document.createElement('div');
        grid.className = 'grid gap-3 grid-cols-1 md:grid-cols-2 md:gap-4 lg:grid-cols-3';

        items.forEach((s) => {
            const sid = getServiceId(s);
            const rawTitle = getServiceTitle(s);
            const { label: title, emoji: titleEmoji } = extractGroupLabelAndEmoji(rawTitle);
            const prov = getProviderName(s);
            const mark = (titleEmoji || '').trim() || (title || 'U').trim().charAt(0).toUpperCase();

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = [
                'svc-card svc-watermark group w-full text-left',
                'rounded-2xl border border-slate-200 dark:border-slate-800',
                'bg-white/95 dark:bg-slate-900/95',
                'px-4 py-4 md:px-4 md:py-4',
                'transition duration-150 ease-out',
                'focus:outline-none focus:ring-2 focus:ring-brand'
            ].join(' ');
            btn.setAttribute('data-mark', mark);

            btn.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="min-w-0 flex-1">
          <div class="text-base md:text-[1.05rem] font-semibold leading-snug text-brand break-anywhere">
            ${escapeHTML(title)}
          </div>
          ${prov ? `<div class="mt-0.5 text-[13.5px] md:text-sm svc-subtle break-anywhere">${escapeHTML(prov)}</div>` : ''}
        </div>
        <div class="svc-chevron shrink-0 opacity-60 transition-transform">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
               class="text-slate-400 dark:text-slate-400">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>
      </div>
    `;

            btn.onclick = () => { updateHash({ view:'service', service:sid, group:groupId }); haptic('impact'); };
            grid.appendChild(btn);
        });

        mountWithMode(grid, 'services', false);
    }

    async function showServiceScreen(serviceId){
        setTitleInstant('Услуга');   // временно, сменим после загрузки

        const backBtn = document.getElementById('navBack');
        if (backBtn) {
            backBtn.textContent = deepLinkForceHome ? 'В главное меню' : backBtn.textContent || '';
            backBtn.onclick = () => {
                if (deepLinkForceHome) {
                    deepLinkForceHome = false;
                    const base = (location.origin + location.pathname.replace(/index\.html$/i, '')).replace(/\/+$/, '/') ;
                    location.href = base;
                } else {
                    history.back();
                }
            };
        }

        mountWithMode(pageLoading('Загрузка услуги...'), 'services', false);
        ensureHeaderVisible && ensureHeaderVisible();

        let service = serviceDetailsCache.get(serviceId);
        if (MOCK_MODE && !service) {
            service = mockData.serviceDetails[serviceId] || mockData.serviceDetails[Number(serviceId)];
            if (service) serviceDetailsCache.set(serviceId, service);
        }
        if(!service){
            try{
                const r = await fetch(`${apiBaseUrl}service_details/${serviceId}`, { method:'POST', headers:{'Content-Type':'application/json'} });
                if (r.status === 404) {
                    setTitleInstant('Услуга');
                    mountWithMode(pageError('Услуга не найдена.'), 'services', false);
                    ensureHeaderVisible && ensureHeaderVisible();
                    return;
                }
                if(!r.ok) throw new Error('Ошибка сервера');
                service = await r.json();
                if (!service || service.error) {
                    setTitleInstant('Услуга');
                    mountWithMode(pageError('Услуга не найдена.'), 'services', false);
                    ensureHeaderVisible && ensureHeaderVisible();
                    return;
                }
                serviceDetailsCache.set(serviceId, service);
            } catch(e){
                mountWithMode(pageError('Не удалось загрузить данные услуги.'), 'services');
                console.error(e);
                ensureHeaderVisible && ensureHeaderVisible();
                return;
            }
        }
        renderServiceDetails(service);
        sendAnalyticsEvent('view', { view:'service', entityType:'service', entityId:serviceId });
        ensureHeaderVisible && ensureHeaderVisible();
        fetchFeedbacks(serviceId);
    }

    function renderServiceDetails(service){
        const parts=[];
        const { label: cleanTitle } = extractGroupLabelAndEmoji(getServiceTitle(service));
        setTitleInstant('Услуга');
        parts.push(`<h2 class="text-2xl font-bold text-brand mb-2 break-anywhere">${escapeHTML(cleanTitle)}</h2>`);
        if (service.shortDescription) {
            const sd = String(service.shortDescription).trim();
            const ttitle = getServiceTitle(service).trim();
            if (sd && sd.toLowerCase() !== ttitle.toLowerCase()) {
                parts.push(
                    `<div class="rounded-lg bg-gradient-to-r from-[var(--sd-from)] to-[var(--sd-to)] text-[var(--sd-fg)] px-4 py-3 mb-4">
        ${escapeHTML(sd)}
      </div>`
                );
            }
        }

        if(service.service){ parts.push(`<div class="mb-4"><p class="font-medium mb-1">🎲 Описание:</p><div class="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap break-anywhere">${linkify(service.service)}</div></div>`); }
        parts.push(`<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div><p class="font-medium">👤 Контактное лицо</p><div class="text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-anywhere">${escapeHTML(service.contactPerson||'Не указано')}</div></div>
      <div><p class="font-medium">📞 Контакты</p><div class="text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-anywhere">${formatPhoneNumbers((service.contacts||'').replace(/\n/g,'\n'))}</div></div>
    </div>`);
        parts.push(`<div id="feedbacks-container" class="mt-6"></div>`);
        mountWithMode(`<div class="space-y-2 animate-in">${parts.join('')}</div>`, 'services', false);
    }
    async function fetchFeedbacks(serviceId){
        const container=document.getElementById('feedbacks-container'); if(!container) return; container.innerHTML = inlineSpinner('Загружаем отзывы...');
        let feedbacks;
        try{
            if (MOCK_MODE) {
                feedbacks = mockData.feedbacks[serviceId] || mockData.feedbacks[Number(serviceId)] || [];
                feedbacksCache.set(serviceId, feedbacks);
            } else {
                if(feedbacksCache.has(serviceId)) feedbacks=feedbacksCache.get(serviceId);
                else { const r=await fetch(apiBaseUrl+'getFeedbacks/'+encodeURIComponent(serviceId), { method:'POST', headers:{'Content-Type':'application/json'} }); if(!r.ok) throw new Error('Bad response'); feedbacks=await r.json(); feedbacksCache.set(serviceId, feedbacks); }
            }
            if(feedbacks.message){ container.innerHTML = `<div class="rounded-lg border border-slate-200 dark:border-slate-800 p-4 text-sm">${escapeHTML(feedbacks.message)}</div>`; }
            else{
                const items = Array.isArray(feedbacks) ? feedbacks : [];
                if (!items.length) {
                    container.innerHTML = `<div class="rounded-lg border border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-600 dark:text-slate-300">Нет отзывов для данной услуги.</div>`;
                    return;
                }
                const avg = calculateAverageRating(items);
                const list=document.createElement('div'); list.className='space-y-3';
                const header=`<div class=\"mb-2 text-sm\"><span class=\"font-medium\">Средняя оценка: ${avg}⭐️</span></div>`;
                items.forEach(f=>{
                    const item=document.createElement('div'); item.className='rounded-lg border border-slate-200 dark:border-slate-800 p-3 animate-in';
                    item.innerHTML=`<div class="flex items-center justify-between text-sm"><strong>${escapeHTML(f.usersName||'Аноним')}</strong><span class="text-slate-500">Оценка: ${escapeHTML(String(f.feedbackRating||'—'))}</span></div>
                           <p class="mt-2 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-anywhere">${escapeHTML(f.feedbackText||'')}</p>`;
                    list.appendChild(item);
                });
                container.innerHTML = header; container.appendChild(list);
            }
        }catch(e){ container.innerHTML = pageError('Не удалось загрузить отзывы.'); console.error(e); }
    }

    // --- Организации ---

    async function showOrgGroupsScreen(){
        setTitle('Все организации');
        if(!orgGroupsCache){
            mountWithMode(pageLoading('Загружаем организации...'), 'orgs', true);
            await fetchOrgGroups();
        }
        if(!orgGroupsCache) return;
        renderOrgGroups(orgGroupsCache || []);
        sendAnalyticsEvent('view', { view:'org-groups', metadata:{groups:(orgGroupsCache||[]).length||0} });
        ensureHeaderVisible && ensureHeaderVisible();
    }

    async function fetchOrgGroups(){
        if (MOCK_MODE) {
            orgGroupsCache = mockData.orgGroups;
            return orgGroupsCache;
        }
        if(orgGroupsCache || orgGroupsLoading) { await orgGroupsLoading; return orgGroupsCache; }
        orgGroupsLoading = (async()=>{
            try{
                const r = await fetch(apiBaseUrl + 'get_organisation_groups', { method:'POST', headers:{'Content-Type':'application/json'} });
                if(!r.ok) throw new Error('Bad response');
                orgGroupsCache = await r.json();
            } catch(e){
                console.error(e);
                mountWithMode(pageError('Не удалось загрузить группы организаций.'), 'orgs');
                return null;
            } finally {
                orgGroupsLoading = null;
            }
        })();
        await orgGroupsLoading; return orgGroupsCache;
    }

    function renderOrgGroups(groups){
        if(!groups?.length){
            mountWithMode(emptyState('Нет групп организаций','Попробуйте обновить позже.'), 'orgs', true);
            return;
        }
        const wrapper = document.createElement('div');
        wrapper.className = 'grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

        groups.forEach(g => {
            const gid  = getOrgGroupId(g);
            const raw  = getOrgGroupName(g) || '';
            if (gid && raw) orgGroupNameCache.set(String(gid), String(raw));

            const { label, emoji } = extractGroupLabelAndEmoji ? extractGroupLabelAndEmoji(raw) : { label: raw, emoji: '' };

            const card = document.createElement('button');
            card.type = 'button';
            card.className = [
                'svc-card grp-watermark group w-full text-left',
                'rounded-2xl border border-slate-200 dark:border-slate-800',
                'bg-white/95 dark:bg-slate-900/95',
                'px-4 py-4 md:px-4 md:py-4',
                'transition duration-150 ease-out',
                'focus:outline-none focus:ring-2 focus:ring-brand'
            ].join(' ');
            card.setAttribute('data-emoji', emoji || '');

            card.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="min-w-0 flex-1">
          <div class="text-base md:text-[1.05rem] font-semibold leading-snug text-brand break-anywhere">
            ${escapeHTML(label)}
          </div>
        </div>
        <div class="row-chevron svc-chevron shrink-0 opacity-60 transition-transform">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
               class="text-slate-400 dark:text-slate-400">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>
      </div>
    `;

            card.onclick = () => { updateHash({ view:'org-group', orgGroup: gid }); haptic('impact'); };
            wrapper.appendChild(card);
        });

        mountWithMode(wrapper, 'orgs', true);
    }

    async function showOrgGroupScreen(groupId){
        const cached = orgGroupNameCache.get(String(groupId));
        if (cached) {
            setTitleInstant(cached);
        } else {
            setTitleLoadingPlaceholder();
        }

        mountWithMode(pageLoading('Загружаем организации...'), 'orgs', false);

        resolveOrgGroupName(groupId).then(name => {
            if (name && name !== cached) setTitleInstant(name);
        });

        const organisations = await fetchOrganisations(groupId);
        if (organisations === null) return;
        renderOrganisations(organisations, groupId);
        sendAnalyticsEvent('view', { view:'org-group', entityType:'org_group', entityId:groupId, metadata:{organisations:Array.isArray(organisations)?organisations.length:(organisations?.items?.length||0)} });

        ensureHeaderVisible && ensureHeaderVisible();
    }

    async function fetchOrganisations(groupId){
        if(orgListsCache.has(groupId)) return orgListsCache.get(groupId);
        if (MOCK_MODE) {
            const data = mockData.organisations[groupId] || mockData.organisations[Number(groupId)] || [];
            orgListsCache.set(groupId, data);
            return data;
        }
        try{
            const r = await fetch(`${apiBaseUrl}get_organisations`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ group_id: Number(groupId) || groupId }) });
            if(!r.ok) throw new Error('Ошибка при загрузке организаций');
            const data = await r.json(); orgListsCache.set(groupId, data); return data;
        }catch(e){
            mountWithMode(pageError('Не удалось загрузить организации.'), 'orgs');
            console.error(e);
            return null;
        }
    }

    function renderOrganisations(list, groupId){
        const items = Array.isArray(list) ? list : (list?.items || []);
        if (!items.length) { mountWithMode(emptyState('Организаций пока нет','Попробуйте выбрать другую группу.'), 'orgs', false); return; }

        const grid = document.createElement('div');
        grid.className = 'grid gap-3 grid-cols-1 md:grid-cols-2 md:gap-4 lg:grid-cols-3';

        items.forEach((org) => {
            const oid = getOrganisationId(org);
            const { label: name, emoji: markEmoji } = extractGroupLabelAndEmoji(getOrganisationName(org));
            const address = getOrganisationAddress(org);
            const mark = markEmoji || (name || 'O').trim().charAt(0).toUpperCase();

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = [
                'svc-card svc-watermark group w-full text-left',
                'rounded-2xl border border-slate-200 dark:border-slate-800',
                'bg-white/95 dark:bg-slate-900/95',
                'px-4 py-4 md:px-4 md:py-4',
                'transition duration-150 ease-out',
                'focus:outline-none focus:ring-2 focus:ring-brand'
            ].join(' ');
            btn.setAttribute('data-mark', mark);

            btn.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="min-w-0 flex-1">
          <div class="text-base md:text-[1.05rem] font-semibold leading-snug text-brand break-anywhere">
            ${escapeHTML(name)}
          </div>
          ${address ? `<div class="mt-0.5 text-[13.5px] md:text-sm svc-subtle break-anywhere">${escapeHTML(address)}</div>` : ''}
        </div>
        <div class="svc-chevron shrink-0 opacity-60 transition-transform">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
               class="text-slate-400 dark:text-slate-400">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>
      </div>
    `;

            btn.onclick = () => { updateHash({ view:'org', org: oid, orgGroup: groupId }); haptic('impact'); };
            grid.appendChild(btn);
        });

        mountWithMode(grid, 'orgs', false);
    }

    async function showOrganisationScreen(orgId, groupId){
        setTitleInstant('Организация');

        const backBtn = document.getElementById('navBack');
        if (backBtn) backBtn.onclick = () => history.back();

        mountWithMode(pageLoading('Загружаем данные организации...'), 'orgs');
        ensureHeaderVisible && ensureHeaderVisible();

        let organisation = orgDetailsCache.get(orgId);
        if (MOCK_MODE && !organisation) {
            organisation = mockData.organisationDetails[orgId] || mockData.organisationDetails[Number(orgId)];
            if (organisation) orgDetailsCache.set(orgId, organisation);
        }
        if(!organisation){
            try{
                const r = await fetch(`${apiBaseUrl}get_organisation`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ organisation_id: Number(orgId) || orgId }) });
                if(!r.ok) throw new Error('Ошибка сервера');
                organisation = await r.json();
                orgDetailsCache.set(orgId, organisation);
            } catch(e){
                mountWithMode(pageError('Не удалось загрузить данные организации.'), 'orgs');
                console.error(e);
                ensureHeaderVisible && ensureHeaderVisible();
                return;
            }
        }
        renderOrganisationDetails(organisation, groupId);
        sendAnalyticsEvent('view', { view:'organisation', entityType:'organisation', entityId:orgId });
        ensureHeaderVisible && ensureHeaderVisible();
    }

    function renderOrganisationDetails(org, groupId){
        const { label: name } = extractGroupLabelAndEmoji(getOrganisationName(org));
        setTitleInstant('Организация');

        const address = getOrganisationAddress(org);
        const contactsRaw = (org.contacts ?? org.contact ?? org.phone ?? org.phones ?? '').toString();
        const contacts = contactsRaw.trim() ? formatPhoneNumbers(contactsRaw.replace(/\r?\n/g,'\n')) : 'Не указаны';

        const blocks = [];
        blocks.push(`<h2 class="text-2xl font-bold text-brand mb-2 break-anywhere">${escapeHTML(name)}</h2>`);
        blocks.push(`<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <p class="font-medium mb-1">📍 Адрес</p>
        <div class="text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-anywhere">${address ? escapeHTML(address) : 'Не указан'}</div>
      </div>
      <div>
        <p class="font-medium mb-1">☎️ Контакты</p>
        <div class="text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-anywhere">${contacts}</div>
      </div>
    </div>`);

        mountWithMode(`<div class="space-y-3 animate-in">${blocks.join('')}</div>`, 'orgs', false);
    }

    function setTitleInstant(text){
        const h1 = document.getElementById('appTitle');
        const span = document.getElementById('appTitleText');
        if (!h1 || !span) return;
        h1.classList.remove('loading');
        span.textContent = text || 'Услуги';
        h1.classList.add('fade-swap');
        requestAnimationFrame(()=> h1.classList.remove('fade-swap'));
    }

    function setTitleLoadingPlaceholder(){
        const h1 = document.getElementById('appTitle');
        const span = document.getElementById('appTitleText');
        if(!h1 || !span) return;
        span.textContent = '';         // скрываем текст
        h1.classList.add('loading');   // рисуем "скелетон"
    }

    async function resolveGroupName(groupId){
        const key = String(groupId);
        if (groupNameCache.has(key)) return groupNameCache.get(key);
        if (MOCK_MODE) {
            const found = (mockData.groups || []).find(g => String(getGroupId(g)) === key);
            const name = found ? getGroupName(found) : null;
            if (name) groupNameCache.set(key, name);
            return name || 'Группа';
        }
        const name = await fetchGroupName(groupId); // твоя функция
        if (name) groupNameCache.set(key, name);
        return name || 'Группа';
    }

    async function resolveOrgGroupName(groupId){
        const key = String(groupId);
        if (orgGroupNameCache.has(key)) return orgGroupNameCache.get(key);

        if (MOCK_MODE) {
            const foundMock = (mockData.orgGroups || []).find(g => String(getOrgGroupId(g)) === key);
            const nameMock = foundMock ? getOrgGroupName(foundMock) : null;
            if (nameMock) orgGroupNameCache.set(key, nameMock);
            return nameMock || 'Группа организаций';
        }

        await fetchOrgGroups();
        const found = (orgGroupsCache || []).find(g => String(getOrgGroupId(g)) === key);
        const name = found ? getOrgGroupName(found) : null;
        if (name) orgGroupNameCache.set(key, name);
        return name || 'Группа организаций';
    }

    function showSearchScreen(q){
        setTitle('Поиск');
        sendAnalyticsEvent('view', { view:'search' });

        const view = document.createElement('div');
        view.className = 'space-y-3';
        view.innerHTML = `
    <div class="sticky top-14 pt-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur z-10">
      <div class="relative">
        <input id="searchInput" type="text" inputmode="search" autocomplete="off" spellcheck="false"
               placeholder="Найти среди услуг и организаций..."
               class="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-800 pl-11 pr-14 py-3
                      focus:outline-none focus:ring-2 focus:ring-brand text-base shadow transition" />
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 select-none">🔎</span>

        <!-- круглый хитбокс 36x36, крестик — SVG по центру -->
        <button id="clearSearchBtn" class="search-clear is-empty" aria-label="Очистить" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
    <div id="searchState" class="text-center text-slate-500 py-6">Введите запрос для поиска по услугам и организациям</div>
    <div id="results" class="space-y-2"></div>
  `;
        screen().innerHTML = '';
        screen().appendChild(view);

        ensureHeaderVisible()

        const input   = view.querySelector('#searchInput');
        const clear   = view.querySelector('#clearSearchBtn');
        const state   = view.querySelector('#searchState');
        const results = view.querySelector('#results');

        input.value = q || '';
        updateClearVisibility(); // показать крестик сразу, если q был

        input.addEventListener('input', () => {
            updateClearVisibility();
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        });

        input.addEventListener('input', debounce(() => {
            const v = input.value.trim();
            const p = new URLSearchParams(location.hash.slice(1));
            p.set('view','search');
            if (v) p.set('q', v); else p.delete('q');
            history.replaceState(null, '', '#'+p.toString());
            doSearch(v, state, results);
        }, 220));

        clear.onclick = () => {
            input.value = '';
            updateClearVisibility();
            updateHash({ q: '' }, true);
            results.innerHTML = '';
            state.textContent = 'Введите запрос для поиска по услугам и организациям';
            input.focus();
        };

        if (q) doSearch(q, state, results); else input.focus();

        function isDesktopPointer(){
            return window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        }
        function updateClearVisibility(){
            if (!isDesktopPointer()) {
                clear.classList.add('is-empty');
                return;
            }
            const empty = input.value.trim().length === 0;
            clear.classList.toggle('is-empty', empty);
        }
    }

    function openSearchScreen(){
        const p = new URLSearchParams(location.hash.slice(1));
        p.set('view','search');
        p.delete('q');                 // чистый старт поиска
        location.hash = '#'+p.toString(); // <-- одна запись в истории
    }

    let searchAbort=null;
    function doSearch(query, stateEl, listEl){
        if(!query){ listEl.innerHTML=''; stateEl.textContent='Введите запрос для поиска по услугам и организациям'; return; }
        stateEl.innerHTML = inlineSpinner('Ищем...'); listEl.innerHTML='';
        if(searchAbort) searchAbort.abort(); searchAbort = new AbortController();
        stateEl.classList.remove('hidden');
        stateEl.innerHTML = inlineSpinner('Ищем...');
        listEl.innerHTML = '';
        if (MOCK_MODE) {
            const svc = Object.values(mockData.services || {}).flat().map(item => ({ ...item, type:'service' }));
            const orgs = [];
            Object.entries(mockData.organisations || {}).forEach(([gid, list])=>{
                list.forEach(o=> orgs.push({ ...o, groupId: gid, type:'organisation' }));
            });
            const all = [...svc, ...orgs];
            const ql = query.toLowerCase();
            const filtered = all.filter(item => {
                const title = (item.serviceName || item.shortDescription || item.name || '').toLowerCase();
                const prov = (item.providerName || item.contactPerson || '').toLowerCase();
                return title.includes(ql) || prov.includes(ql);
            });
            renderSearchResults(filtered, stateEl, listEl);
            sendAnalyticsEvent('search', { view:'search', query: query, metadata:{ resultCount: filtered.length } });
            return;
        }
        fetch(`${apiBaseUrl}search_services?query=${encodeURIComponent(query)}`, { signal: searchAbort.signal })
            .then(r=>r.json())
            .then(items=> {
                renderSearchResults(items||[], stateEl, listEl);
                const count = Array.isArray(items) ? items.length : 0;
                sendAnalyticsEvent('search', { view:'search', query: query, metadata:{ resultCount: count } });
            })
            .catch(()=> { stateEl.textContent='Ошибка запроса'; });
    }

    function renderSearchResults(results, stateEl, listEl) {
        const items = Array.isArray(results) ? results : [];

        if (!items.length) {
            stateEl.classList.remove('hidden');
            stateEl.textContent = 'Ничего не найдено';
            listEl.innerHTML = '';
            return;
        }

        stateEl.classList.add('hidden');
        listEl.innerHTML = '';

        const frag = document.createDocumentFragment();

        items.forEach((item) => {
            const inferredType = (item.type || item.kind || '').toString().toLowerCase();
            const hasOrgMarker = (item.organisation_id ?? item.organisationId ?? item.organization_id ?? item.organizationId);
            const type = inferredType === 'organisation' || inferredType === 'org' || hasOrgMarker ? 'organisation' : 'service';

            const sid   = item.servicesID ?? item.serviceId ?? (type === 'service' ? item.id : null);
            const oid   = item.organisation_id ?? item.organisationId ?? item.organization_id ?? item.organizationId ?? (type === 'organisation' ? item.id : null);
            const gid   = item.groupId   ?? item.groupID   ?? item.GroupID ?? item.group_id;

            const rawTitle = type === 'organisation'
                ? (getOrganisationName(item) || item.text || 'Организация')
                : (item.text || item.serviceName || 'Услуга');
            const { label: title, emoji: titleEmoji } = extractGroupLabelAndEmoji(rawTitle);

            const provOrAddr = type === 'organisation'
                ? getOrganisationAddress(item)
                : (item.providerName || item.contactPerson || '');

            const gnameRaw = item.groupName || '';
            const { label: gnameClean, emoji: groupEmoji } = extractGroupLabelAndEmoji(gnameRaw);
            const watermark = titleEmoji || groupEmoji || (title || '').trim().charAt(0).toUpperCase();

            const row = document.createElement('button');
            row.type = 'button';
            row.className = [
                'row-hover sr-watermark w-full text-left',
                'rounded-xl border border-slate-200 dark:border-slate-800',
                'p-3 bg-white dark:bg-slate-900',
                'transition'
            ].join(' ');
            if (watermark) row.setAttribute('data-emoji', watermark); else row.removeAttribute('data-emoji');

            const badge = type === 'organisation'
                ? '<span class="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">Организация</span>'
                : '<span class="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">Услуга</span>';

            row.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap mb-0.5">${badge}</div>
          <div class="font-semibold text-brand text-base leading-tight break-anywhere">
            ${escapeHTML(title)}
          </div>
          ${provOrAddr ? `<div class="text-slate-600 dark:text-slate-400 text-sm mt-0.5 break-anywhere">${escapeHTML(provOrAddr)}</div>` : ''}
          ${gnameClean ? `<div class="text-slate-400 text-xs mt-0.5 break-anywhere">${escapeHTML(gnameClean)}</div>` : ''}
        </div>
        <div class="row-chevron shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
               class="text-slate-400 dark:text-slate-400">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>
      </div>
    `;

            row.onclick = () => {
                const p = new URLSearchParams(location.hash.slice(1));
                if (type === 'organisation') {
                    p.set('view', 'org');
                    if (oid != null) p.set('org', oid);
                    if (gid != null) p.set('orgGroup', gid);
                } else {
                    p.set('view', 'service');
                    if (sid != null) p.set('service', sid);
                    if (gid != null) p.set('group', gid);
                }
                p.delete('q');
                location.hash = '#' + p.toString();
                haptic('impact');
            };

            frag.appendChild(row);
        });

        listEl.appendChild(frag);
    }




    
    function ensureAdminAccess(){
        if (isAdminTokenValid()) {
            adminUnlocked = true;
            updateAdminUi();
            return true;
        }
        showAdminLoginModal();
        return false;
    }

    function updateAdminUi(){
        const statsBtn = document.getElementById('openStats');
        const isAdmin = isAdminTokenValid();
        if (statsBtn){
            statsBtn.classList.toggle('hidden', !isAdmin);
            statsBtn.style.display = isAdmin ? 'inline-flex' : 'none';
        }
    }

    async function logoutAdmin(){
        try{
            await fetch(apiBaseUrl + 'analytics/logout', {
                method:'POST',
                headers:{ 'Content-Type':'application/json', 'X-Analytics-Token': analyticsToken }
            });
        }catch(e){}
        analyticsToken=''; analyticsTokenExp=''; adminUnlocked=false; clearAdminToken(); updateAdminUi();
    }

    function showAdminLoginModal(){
        const existing=document.getElementById('admin-login-overlay');
        if (existing) { existing.remove(); }

        const overlay=document.createElement('div');
        overlay.id='admin-login-overlay';
        overlay.className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4';
        overlay.innerHTML=`
      <div class="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 animate-in">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-xs uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Hidden area</div>
            <div class="text-lg font-semibold text-brand">???? ? ?????-??????????</div>
          </div>
          <button type="button" id="adminLoginClose" class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="???????">?</button>
        </div>
        <p class="text-sm text-slate-600 dark:text-slate-300">??????? ?????? ??????????????, ????? ??????? ??????????. ?????????: ???????????? ????????? ??????.</p>
        <form id="adminLoginForm" class="space-y-3">
          <div>
            <label class="block text-sm font-medium mb-1">??????</label>
            <input type="password" id="adminPasswordInput" class="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand" autocomplete="off" />
            <div id="adminLoginError" class="text-sm text-red-600 mt-1 hidden"></div>
          </div>
          <div class="flex items-center justify-end gap-2">
            <button type="button" id="adminLoginBack" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">?????</button>
            <button type="submit" class="px-3 py-2 rounded-lg bg-brand text-white font-semibold hover:opacity-90">?????</button>
          </div>
        </form>
      </div>`;
        document.body.appendChild(overlay);

        const close=()=>{ overlay.remove(); };
        overlay.querySelector('#adminLoginClose').onclick = close;
        overlay.querySelector('#adminLoginBack').onclick = close;
        const form = overlay.querySelector('#adminLoginForm');
        const input = overlay.querySelector('#adminPasswordInput');
        const err = overlay.querySelector('#adminLoginError');
        input.focus();
        form.onsubmit = async (e)=>{
            e.preventDefault();
            err.classList.add('hidden');
            const password = (input.value||'').trim();
            if(!password){ err.textContent='??????? ??????'; err.classList.remove('hidden'); return; }
            try{
                const r = await fetch(apiBaseUrl+'analytics/login', {
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ password, label: analyticsClientId })
                });
                if(r.status === 401){ err.textContent='???????? ??????'; err.classList.remove('hidden'); return; }
                if(!r.ok) throw new Error('bad response');
                const data = await r.json();
                analyticsToken = data.token;
                analyticsTokenExp = data.expires_at;
                adminUnlocked = true;
                storeAdminToken(analyticsToken, analyticsTokenExp);
                updateAdminUi();
                close();
                showAnalyticsScreen();
            }catch(ex){
                err.textContent='?????? ??? ?????'; err.classList.remove('hidden');
            }
        };
    }

    async function showAnalyticsScreen(){
        if(!ensureAdminAccess()) return;
        setTitle('Analytics');
        setBackVisible(true);
        const container = document.createElement('div');
        container.className = 'space-y-4';
        container.innerHTML = pageLoading('Loading weekly analytics...');
        screen().innerHTML = '';
        screen().appendChild(container);

        try{
            const r = await fetch(apiBaseUrl + 'analytics/weekly_summary', { cache: 'no-store', headers: { 'X-Analytics-Token': analyticsToken } });
            if(r.status === 401){
                clearAdminToken(); adminUnlocked=false; updateAdminUi();
                container.innerHTML = pageError('????? ???? ??????????????.');
                return;
            }
            if(!r.ok) throw new Error('Bad response');
            const data = await r.json();
            renderAnalyticsSummary(container, data);
            sendAnalyticsEvent('view', { view: 'analytics' });
        }catch(e){
            console.error(e);
            container.innerHTML = pageError('Failed to load analytics. Try again later.');
        }
    }

    function renderAnalyticsSummary(container, data){
        const totals = data?.totals || {};
        const windowInfo = data?.window || {};
        const daily = Array.isArray(data?.daily) ? data.daily : [];
        const byEvent = Array.isArray(data?.by_event_type) ? data.by_event_type : [];
        const topServices = Array.isArray(data?.top_services) ? data.top_services : [];
        const topOrgs = Array.isArray(data?.top_organisations) ? data.top_organisations : [];
        const topQueries = Array.isArray(data?.top_queries) ? data.top_queries : [];
        const recent = Array.isArray(data?.recent_events) ? data.recent_events : [];
        const maxDaily = Math.max(...daily.map(d => Number(d.total) || 0), 1);

        container.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.className = 'space-y-4';
        wrap.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="text-xs uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">7 days</div>
        <div class="text-lg font-semibold text-brand">${escapeHTML(windowInfo.start || '')} - ${escapeHTML(windowInfo.end || '')}</div>
      </div>
      <div class="flex items-center gap-2">
        <button type="button" class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold" id="analyticsLogout">?????</button>
        <button type="button" class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold" id="analyticsReload">Refresh</button>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div class="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white/90 dark:bg-slate-900/80">
        <div class="text-sm text-slate-500 dark:text-slate-400">Events</div>
        <div class="text-2xl font-bold">${Number(totals.events || 0)}</div>
      </div>
      <div class="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white/90 dark:bg-slate-900/80">
        <div class="text-sm text-slate-500 dark:text-slate-400">Unique visitors</div>
        <div class="text-2xl font-bold">${Number(totals.unique_visitors || 0)}</div>
      </div>
      <div class="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white/90 dark:bg-slate-900/80">
        <div class="text-sm text-slate-500 dark:text-slate-400">Unique clients</div>
        <div class="text-2xl font-bold">${Number(totals.unique_clients || totals.unique_users || 0)}</div>
      </div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div class="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white/90 dark:bg-slate-900/80">
        <div class="font-semibold mb-3">Daily trend</div>
        <div class="space-y-2" id="analyticsDaily"></div>
      </div>
      <div class="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white/90 dark:bg-slate-900/80">
        <div class="font-semibold mb-3">By event type</div>
        <div class="space-y-2" id="analyticsByEvent"></div>
      </div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <div class="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white/90 dark:bg-slate-900/80">
        <div class="font-semibold mb-3">Top services</div>
        <div class="space-y-2" id="analyticsTopServices"></div>
      </div>
      <div class="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white/90 dark:bg-slate-900/80">
        <div class="font-semibold mb-3">Top organisations</div>
        <div class="space-y-2" id="analyticsTopOrgs"></div>
      </div>
      <div class="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white/90 dark:bg-slate-900/80">
        <div class="font-semibold mb-3">Popular queries</div>
        <div class="space-y-2" id="analyticsTopQueries"></div>
      </div>
    </div>
    <div class="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white/90 dark:bg-slate-900/80">
      <div class="font-semibold mb-3">Latest events</div>
      <div class="space-y-2" id="analyticsRecent"></div>
    </div>
        `;
        container.appendChild(wrap);

        const dailyBox = wrap.querySelector('#analyticsDaily');
        if(!daily.length){ dailyBox.innerHTML = '<div class="text-sm text-slate-500">No events yet.</div>'; }
        else{
            daily.forEach(d => {
                const row=document.createElement('div');
                row.className='flex items-center gap-2';
                const total=Number(d.total)||0;
                const width=Math.max(8, (total/maxDaily)*100);
                row.innerHTML=`<div class="w-24 text-sm font-medium">${escapeHTML(d.day||'')}</div>
        <div class="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-800 relative overflow-hidden">
          <span class="absolute inset-y-0 left-0 rounded-full bg-brand" style="width:${width}%"></span>
        </div>
        <div class="w-12 text-right text-sm">${total}</div>`;
                dailyBox.appendChild(row);
            });
        }

        const byEventBox = wrap.querySelector('#analyticsByEvent');
        renderRankedList(byEventBox, byEvent, (row)=>row.event_type || 'unknown', 'total', 'No grouped events yet');

        renderRankedList(wrap.querySelector('#analyticsTopServices'), topServices, (row)=>row.title || `ID ${row.service_id||'-'}`, 'total', 'No service views yet');
        renderRankedList(wrap.querySelector('#analyticsTopOrgs'), topOrgs, (row)=>row.title || `ID ${row.organisation_id||'-'}`, 'total', 'No organisation views yet');
        renderRankedList(wrap.querySelector('#analyticsTopQueries'), topQueries, (row)=>row.query || '-', 'total', 'No search activity yet');

        const recentBox = wrap.querySelector('#analyticsRecent');
        if(!recent.length){ recentBox.innerHTML = '<div class="text-sm text-slate-500">No recent events yet.</div>'; }
        else{
            recent.forEach(evt => {
                const item=document.createElement('div');
                item.className='rounded-lg border border-slate-200 dark:border-slate-800 p-3';
                const metaParts=[];
                if(evt.entity_type){ metaParts.push(escapeHTML(evt.entity_type)); }
                if(evt.entity_id){ metaParts.push(`#${evt.entity_id}`); }
                if(evt.query){ metaParts.push(`"${escapeHTML(evt.query)}"`); }
                item.innerHTML=`<div class="flex items-center justify-between text-sm font-semibold text-brand"><span>${escapeHTML(evt.event_type||'')}</span><span>${formatDateTimeLocal(evt.created_at)}</span></div>
        <div class="text-sm text-slate-600 dark:text-slate-300 mt-1">${metaParts.join(' | ') || '-'}</div>`;
                recentBox.appendChild(item);
            });
        }

        const reload = wrap.querySelector('#analyticsReload');
        if (reload) reload.onclick = () => showAnalyticsScreen();
        const logout = wrap.querySelector('#analyticsLogout');
        if (logout) logout.onclick = () => { logoutAdmin(); screen().innerHTML = pageError('?????? ??????.'); };

        function renderRankedList(box, list, labelFn, valueKey, emptyText){
            if(!box) return;
            if(!Array.isArray(list) || !list.length){ box.innerHTML = `<div class="text-sm text-slate-500">${emptyText}</div>`; return; }
            box.innerHTML='';
            list.forEach((row, idx)=>{
                const val=Number(row?.[valueKey]||0);
                const label=labelFn(row, idx);
                const rowEl=document.createElement('div');
                rowEl.className='flex items-center justify-between gap-3 text-sm';
                rowEl.innerHTML=`<div class="font-medium">${idx+1}. ${escapeHTML(label||'-')}</div><div class="text-slate-500">${val}</div>`;
                box.appendChild(rowEl);
            });
        }
    }

    function debounce(fn, ms=200){
        let t; return function(...args){
            clearTimeout(t);
            t = setTimeout(()=>fn.apply(this,args), ms);
        };
    }

    async function fetchGroupName(groupId) {
        try {
            const r = await fetch(`${apiBaseUrl}group/${groupId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!r.ok) throw new Error('Bad response');
            const data = await r.json();
            const name = data.name || 'Группа';
            groupNameCache.set(String(groupId), name);
            return name;
        } catch (e) {
            console.error(e);
            return groupNameCache.get(String(groupId)) || 'Группа';
        }
    }


    function ensureHeaderVisible() {
        try {
            const sc = document.scrollingElement || document.documentElement;
            if (sc) sc.scrollTop = 0;
        } catch {}

        const hdr = document.querySelector('header');
        if (hdr) {
            hdr.offsetHeight;
            hdr.classList.add('repaint');
            requestAnimationFrame(() => hdr.classList.remove('repaint'));
        }

        try { refreshTitleMarquee(); } catch {}
    }

    function mountWithMode(content, activeMode='services', showSwitch=true){
        const container = document.createElement('div');
        container.className = 'space-y-4';
        if (showSwitch) container.appendChild(buildModeSwitch(activeMode));
        container.appendChild(asNode(content));
        screen().innerHTML = '';
        screen().appendChild(container);
    }

    function asNode(content){
        if (content instanceof HTMLElement) return content;
        const wrap = document.createElement('div');
        wrap.innerHTML = String(content ?? '');
        return wrap;
    }

    function buildModeSwitch(activeMode='services'){
        const wrap = document.createElement('div');
        wrap.className = 'pt-1 pb-1';
        wrap.innerHTML = `
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
        <span class="inline-flex h-2 w-2 rounded-full bg-gradient-to-r from-brand to-indigo-500 shadow-sm shadow-indigo-200"></span>
        Навигация
      </div>
      <div class="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 p-1">
        <button type="button" data-mode="services" class="mode-tab px-3 py-1.5 rounded-full text-sm font-semibold transition">Услуги</button>
        <button type="button" data-mode="orgs" class="mode-tab px-3 py-1.5 rounded-full text-sm font-semibold transition">Организации</button>
      </div>
    </div>`;

        const buttons = wrap.querySelectorAll('.mode-tab');
        buttons.forEach(btn => {
            const mode = btn.dataset.mode;
            const isActive = mode === activeMode;
            btn.className = [
                'mode-tab px-3 py-1.5 rounded-full text-sm font-semibold transition',
                isActive
                    ? 'bg-white dark:bg-slate-900 text-brand shadow-sm border border-brand/30 dark:border-brand/40'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            ].join(' ');

            btn.onclick = () => {
                if (isActive) return;
                haptic('impact');
                if (mode === 'services') {
                    updateHash({ view:'groups', group:null, service:null, orgGroup:null, org:null, q:'' });
                } else {
                    updateHash({ view:'org-groups', group:null, service:null, orgGroup:null, org:null, q:'' });
                }
            };
        });

        return wrap;
    }


    function pageLoading(msg){ return `<div class="flex flex-col items-center justify-center py-16 gap-3"><div class="w-10 h-10 border-2 border-slate-300 dark:border-slate-700 border-t-brand rounded-full animate-spin"></div><p class="text-sm text-slate-500">${escapeHTML(msg)}</p></div>`; }
    function pageError(msg){ return `<div class="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-200 p-4">${escapeHTML(msg)}</div>`; }
    function emptyState(title, sub){ return `<div class="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center"><div class="text-3xl mb-2">🙂</div><div class="font-medium mb-1">${escapeHTML(title)}</div><div class="text-sm text-slate-500">${escapeHTML(sub||'')}</div></div>`; }
    function inlineSpinner(msg){ return `<div class="flex items-center justify-center gap-2 text-sm text-slate-500 py-2"><div class="w-5 h-5 border-2 border-slate-300 dark:border-slate-700 border-t-brand rounded-full animate-spin"></div><span>${escapeHTML(msg)}</span></div>`; }

    function escapeHTML(str){ return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;'); }
    function getGroupId(g){ return g.groupId ?? g.GroupID ?? g.id ?? g.ID ?? g.groupID ?? String(g.name || g.title || Math.random().toString(36).slice(2)); }
    function getGroupName(g){ return g.groupName ?? g.GroupName ?? g.name ?? g.title ?? 'Группа'; }
    function getServiceId(s){ return s.servicesID ?? s.serviceId ?? s.id ?? s.ID ?? s.ServiceID ?? s.ServicesID ?? Math.random().toString(36).slice(2); }
    function getServiceTitle(s){ return s.shortDescription ?? s.serviceName ?? s.title ?? 'Услуга'; }
    function getProviderName(s){ return s.providerName ?? s.provider ?? s.ownerName ?? s.contactPerson ?? ''; }
    function getOrgGroupId(g){ return g.groupId ?? g.group_id ?? g.id ?? g.ID ?? g.GroupID ?? g.groupID ?? Math.random().toString(36).slice(2); }
    function getOrgGroupName(g){ return g.groupName ?? g.group_name ?? g.name ?? g.title ?? 'Группа организаций'; }
    function getOrganisationId(o){ return o.organisation_id ?? o.organisationId ?? o.organizationsID ?? o.organization_id ?? o.id ?? o.ID ?? o.organisationID ?? Math.random().toString(36).slice(2); }
    function getOrganisationName(o){ return o.name ?? o.organisationName ?? o.organizationName ?? o.title ?? 'Организация'; }
    function getOrganisationAddress(o){ return o.address ?? o.location ?? o.addr ?? ''; }
    function formatPhoneNumbers(text){ const lines=String(text||'').split('\n'); return lines.map(l=>{ const t=l.trim(); const num=t.replace(/[^\d+]/g,''); if(num.length>=7){ return `<a class=\"underline underline-offset-2\" href=\"tel:${escapeHTML(num)}\">${escapeHTML(t)}</a>`;} return escapeHTML(t); }).join('<br>'); }
    function linkify(text){ const esc=escapeHTML(String(text||'')); const urlRe=/\b((?:https?:\/\/|ftp:\/\/)[^\s<>"']+|www\.[^\s<>"']+)/gi; return esc.replace(urlRe,(m)=>{ const href=m.startsWith('http')||m.startsWith('ftp')? m : ('https://'+m); return `<a class=\"underline underline-offset-2 break-anywhere\" href=\"${href}\" target=\"_blank\" rel=\"noopener noreferrer\">${m}</a>`; }); }
    function calculateAverageRating(list){ if(!Array.isArray(list)||list.length===0) return 0; const nums=list.map(x=>Number(x.feedbackRating)).filter(n=>Number.isFinite(n)); if(nums.length===0) return 0; const avg=nums.reduce((a,b)=>a+b,0)/nums.length; return Math.round(avg*10)/10; }


    function formatDateTimeLocal(ts){ try{ return new Date(ts).toLocaleString(); }catch(e){ return ts||''; } }

    function ensureAnalyticsClientId(){
        try{
            const key='svc_analytics_client_id';
            const stored=localStorage.getItem(key);
            if(stored) return stored;
            const fresh=(typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'client-'+Math.random().toString(16).slice(2))+'-'+Date.now();
            localStorage.setItem(key,fresh);
            return fresh;
        }catch(e){
            return 'anon-'+Math.random().toString(16).slice(2);
        }
    }

    function loadAdminToken(){ try{ return localStorage.getItem('svc_admin_token') || ''; }catch{ return ''; } }
    function loadAdminTokenExp(){ try{ return localStorage.getItem('svc_admin_token_exp') || ''; }catch{ return ''; } }
    function storeAdminToken(token, expiresAt){ try{ localStorage.setItem('svc_admin_token', token||''); localStorage.setItem('svc_admin_token_exp', expiresAt||''); }catch{} }
    function clearAdminToken(){ storeAdminToken('', ''); }
    function isAdminTokenValid(){ if(!analyticsToken) return false; if(!analyticsTokenExp) return true; try{ return new Date(analyticsTokenExp) > new Date(); }catch{ return true; } }

    function sendAnalyticsEvent(eventType, payload={}){
        if(!eventType) return;
        const body={
            event_type:eventType,
            client_id:analyticsClientId,
            view:payload.view,
            entity_type:payload.entityType,
            entity_id:payload.entityId,
            query:payload.query,
            metadata:payload.metadata,
            occurred_at:new Date().toISOString()
        };
        try{
            fetch(apiBaseUrl+'analytics/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive:true}).catch(()=>{});
        }catch(e){
            console.warn('analytics send failed',e);
        }
    }
