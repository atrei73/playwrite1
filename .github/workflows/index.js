const { chromium } = require('playwright');
const fs = require('fs');

// Читаем реферы из файла refer.txt
const referrers = fs.readFileSync('refer.txt', 'utf-8').split('\n').filter(Boolean);

// Читаем прокси из файла proxies.txt
const proxies = fs.readFileSync('proxies.txt', 'utf-8')
    .split(/\r?\n/)  // Разделяет и "\n", и "\r\n"
    .map(line => line.trim())  // Убирает пробелы и лишние символы
    .filter(line => line && line.includes(':')); // Убирает пустые строки и некорректные прокси

// Читаем user agents из файла user_agents.txt
const userAgents = fs.readFileSync('user_agents.txt', 'utf-8').split('\n').filter(Boolean);

// Функция для плавного автоскролла
async function autoScroll(page) {
    await page.waitForTimeout(5000);
    const scrollTimeDown = Math.floor(Math.random() * 2000) + 1000;
    const scrollTimeUp = Math.floor(Math.random() * 2000) + 1000;
    
    await page.evaluate(async (scrollTimeDown) => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const step = distance / (scrollTimeDown / 100);
            const timer = setInterval(() => {
                window.scrollBy(0, step);
                totalHeight += step;

                if (totalHeight >= document.body.scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 10);
        });
    }, scrollTimeDown);
    
    await page.evaluate(async (scrollTimeUp) => {
        await new Promise((resolve) => {
            let totalHeight = document.body.scrollHeight;
            const distance = 100;
            const step = distance / (scrollTimeUp / 100);
            const timer = setInterval(() => {
                window.scrollBy(0, -step);
                totalHeight -= step;

                if (totalHeight <= 0) {
                    clearInterval(timer);
                    resolve();
                }
            }, 10);
        });
    }, scrollTimeUp);
    
    await page.waitForTimeout(5000);
}

(async () => {
    const randomProxy = proxies[Math.floor(Math.random() * proxies.length)];
    const [proxyHost, proxyPort, proxyUser, proxyPass] = randomProxy.split(':');

    console.log(`Используемый прокси: ${proxyHost}:${proxyPort} (username: ${proxyUser}, password: ${proxyPass})`);
    let closeTimeout;
    const browser = await chromium.launch({
        headless: true,
        proxy: {
            server: `http://${proxyHost}:${proxyPort}`,
            username: proxyUser,
            password: proxyPass
        }
    });

    const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    console.log(`Используемый user agent: ${randomUserAgent}`);

    const context = await browser.newContext({
        userAgent: randomUserAgent,
        viewport: { width: 1280, height: 720 }
    });

    const page = await context.newPage();
    const randomReferrer = referrers[Math.floor(Math.random() * referrers.length)];
    console.log(`Установленный реферер: ${randomReferrer}`);

    page.on('crash', async () => {
        console.error('Страница аварийно завершила работу. Закрытие браузера.');
        await browser.close();
    });

    await page.goto('http://osdon.ru/', { waitUntil: 'domcontentloaded', referer: randomReferrer });
    await page.waitForTimeout(5000);
    console.log('Загрузка страницы http://osdon.ru/ завершена.');

    const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href*="osdon.ru"]')).map(link => link.href);
    });

    if (links.length > 0) {
        const randomLink = links[Math.floor(Math.random() * links.length)];
        console.log(`Случайная ссылка для перехода: ${randomLink}`);

        await page.goto(randomLink, { waitUntil: 'domcontentloaded', referer: randomReferrer });
        await page.waitForTimeout(15000);
        console.log('Переход по случайной ссылке выполнен.');
        await autoScroll(page);

        await page.waitForTimeout(15000);

        const frameHandles = await page.$$('iframe[style*="overflow: hidden;"]');
            console.log(`Найдено ${frameHandles.length} iframe с атрибутом scrolling="no" на странице.`);

            // Добавим таймер, чтобы закрыть браузер через 40 секунд
            closeTimeout = setTimeout(async () => {
                console.log('Закрытие браузера через 40 секунд после клика по фрейму.');
                await browser.close();
                    }, 70000);

        if (frameHandles.length > 0) {
            const randomFrameHandle = frameHandles[Math.floor(Math.random() * frameHandles.length)];
            console.log('Клик по случайному iframe с атрибутом frameborder="0".');
            const [newPage] = await Promise.all([
                context.waitForEvent('page'),
                randomFrameHandle.click()
            ]);
            await newPage.waitForTimeout(15000);
            await autoScroll(newPage);
            console.log('Переход и действия на новом сайте выполняются.');

            for (let i = 0; i < Math.floor(Math.random() * 3) + 2; i++) {
                const clickableElements = await newPage.$$('a, button, [role="button"], iframe, div, img');
                console.log(`Количество кликабельных элементов на странице: ${clickableElements.length}`);
                if (clickableElements.length > 0) {
                    const randomClickable = clickableElements[Math.floor(Math.random() * clickableElements.length)];
                    await randomClickable.scrollIntoViewIfNeeded();
                    await newPage.waitForTimeout(15000);
                    await randomClickable.click();
                    console.log('Клик по случайному кликабельному элементу на новой странице выполнен.');
                    await autoScroll(newPage);
                    await newPage.waitForTimeout(15000);
                }
            }
        } else {
            console.log("Не найдено iframe с атрибутом frameborder=\"0\" на странице.");
            clearTimeout(closeTimeout); // Отмена таймера, если фреймов нет
            await browser.close();
        }
    } else {
        console.log("Не найдено ссылок, содержащих 'osdon'.");
    }

    await browser.close();
    clearTimeout(closeTimeout); // Отмена таймера при закрытии браузера
})();
