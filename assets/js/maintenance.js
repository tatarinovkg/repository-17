(function () {
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

    const WORK_URL = 'https://bot.ovimex72.ru/api/works';

    const setView = (mode) => {
        if (mode === 'loading') {
            overlay.classList.remove('hidden');
            loadingEl?.classList.remove('hidden');
            contentEl?.classList.add('hidden');
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
        setView('loading');
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
                window.dispatchEvent(new CustomEvent('maintenance:active', {detail: data}));
            } else {
                hideOverlay();
                window.dispatchEvent(new CustomEvent('maintenance:ok', {detail: data}));
            }
        } catch (error) {
            titleEl.textContent = 'Нет ответа от сервера';
            detailEl.textContent = 'Не удаётся связаться с сервером. Скорее всего он недоступен - пробуем восстановить соединение.';
            whatEl.textContent = 'Проверяем подключение и перезапускаем сервисы';
            whenEl.textContent = 'Вернёмся, как только сервер ответит';
            setView('content');
            window.dispatchEvent(new CustomEvent('maintenance:error', {detail: {error: error?.message}}));
        } finally {
            stampUpdated();
        }
    };

    retryBtn?.addEventListener('click', checkMaintenance);

    document.addEventListener('DOMContentLoaded', () => {
        window.maintenanceReady = checkMaintenance();
    });
})();
