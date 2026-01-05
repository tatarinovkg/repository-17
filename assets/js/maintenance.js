(function () {
    const state = window.maintenanceState = window.maintenanceState || { status: 'pending' };
    const overlay = document.getElementById('maintenance-overlay');
    if (!overlay) return;

    const titleEl = document.getElementById('maintenance-title');
    const detailEl = document.getElementById('maintenance-detail');
    const updatedEl = document.getElementById('maintenance-updated');
    const whatEl = document.getElementById('maintenance-what');
    const whenEl = document.getElementById('maintenance-when');
    const retryBtn = document.getElementById('maintenanceRetry');
    const loadingEl = document.getElementById('maintenance-loading');
    const contentEl = document.getElementById('maintenance-content');

    const WORK_URL = 'https://api.s.tkgn.ru/api/works';

    const setView = (mode) => {
        if (mode === 'loading') {
            overlay.classList.remove('hidden');
            loadingEl?.classList.remove('hidden');
            contentEl?.classList.add('hidden');
            state.status = 'pending';
        } else if (mode === 'content') {
            overlay.classList.remove('hidden');
            loadingEl?.classList.add('hidden');
            contentEl?.classList.remove('hidden');
        }
        document.body.classList.add('overflow-hidden');
    };

    const hideOverlay = () => {
        overlay.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    };

    const stampUpdated = () => {
        const now = new Date();
        updatedEl.textContent = `Обновлено: ${now.toLocaleTimeString()}`;
    };

    const checkMaintenance = async () => {
        hideOverlay();
        updatedEl.textContent = 'Обновляем статус...';

        try {
            const response = await fetch(WORK_URL, {cache: 'no-store'});
            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}`);
            }

            const data = await response.json().catch(() => ({}));
            const isActive = Boolean(data.active ?? data.maintenance ?? data.works ?? data.work ?? data.activeMaintenance);
            const message = data.message || data.detail || 'Мы выполняем обновление сервисов.';
            const what = data.what || 'Обновляем сервисы, улучшаем стабильность и скорость';
            const when = data.when || data.eta || 'Чуть позже - сообщим сразу после завершения';

            whatEl.textContent = what;
            whenEl.textContent = when;

            if (isActive) {
                titleEl.textContent = 'Сервисы сейчас недоступны';
                detailEl.textContent = message;
                setView('content');
                state.status = 'active';
                window.dispatchEvent(new CustomEvent('maintenance:active', {detail: data}));
            } else {
                hideOverlay();
                state.status = 'ok';
                window.dispatchEvent(new CustomEvent('maintenance:ok', {detail: data}));
            }
        } catch (error) {
            console.error('Maintenance check failed', error);
            titleEl.textContent = 'Сервисы сейчас недоступны';
            detailEl.textContent = 'Не удаётся связаться с сервером. Возможно идут работы или сервер временно недоступен.';
            whatEl.textContent = 'Проверяем подключение и возобновляем сервисы';
            whenEl.textContent = 'Как только сервер ответит, вернёмся сразу';
            state.status = 'active';
            setView('content');
            window.dispatchEvent(new CustomEvent('maintenance:active', {detail: {error: error?.message}}));
        } finally {
            stampUpdated();
        }
    };

    retryBtn?.addEventListener('click', checkMaintenance);

    document.addEventListener('DOMContentLoaded', () => {
        window.maintenanceReady = checkMaintenance();
    });
})();
