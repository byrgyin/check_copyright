import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';

export const crawlSite = async (startUrl: string): Promise<string[]> => {
    // Хранилище посещенных страниц и найденных картинок
    const visitedUrls = new Set<string>();
    const foundImages = new Set<string>();

    const startUrlObj: URL = new URL(startUrl);
    const baseDomain: string = startUrlObj.hostname;

    // Очередь для обхода
    const queue: string[] = [startUrl];

    // Лимит одновременных запросов (потоков)
    const CONCURRENCY_LIMIT = 5;

    // Цикл крутится до тех пор, пока в очереди есть хотя бы одна страница
    while (queue.length > 0) {

        // Достаем из начала очереди пачку страниц
        const chunk = queue.splice(0, CONCURRENCY_LIMIT);

        // Фильтруем, чтобы случайно не обработать дубликаты
        const urlsToProcess = chunk.filter(url => !visitedUrls.has(url));

        if (urlsToProcess.length === 0) continue;

        // Сразу помечаем их как посещенные
        urlsToProcess.forEach(url => visitedUrls.add(url));

        // Запускаем пачку запросов параллельно
        await Promise.all(urlsToProcess.map(async (currentUrl) => {
            // Выводим в консоль, сколько страниц УЖЕ обработано на данный момент
            console.log(`[Crawl] Страниц обработано: ${visitedUrls.size} | В очереди осталось: ${queue.length} | Текущая: ${currentUrl}`);

            try {
                const { data: html } = await axios.get(currentUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MyAngularCrawler/2.0)' },
                    timeout: 6000 // Таймаут 6 секунд
                });

                const $ = cheerio.load(html);

                // 1. Сбор картинок
                $('img').each((_, element) => {
                    const src: string | undefined = $(element).attr('src');
                    if (src) {
                        try {
                            const absoluteImgURl = new URL(src, currentUrl).href;
                            foundImages.add(absoluteImgURl);
                        } catch (e) {}
                    }
                });

                // 2. Сбор ссылок для продолжения обхода
                $('a').each((_, element) => {
                    const href: string | undefined = $(element).attr('href');
                    if (href) {
                        try {
                            const absoluteLink = new URL(href, currentUrl);
                            absoluteLink.hash = ''; // Очищаем хэш (#about -> /about)

                            if (
                                absoluteLink.hostname === baseDomain &&
                                !visitedUrls.has(absoluteLink.href) &&
                                !queue.includes(absoluteLink.href) &&
                                // Защита: игнорируем ссылки, которые содержат знаки вопроса (динамические фильтры/сортировки),
                                // так как они могут генерировать бесконечные комбинации URL и зациклить бота
                                !absoluteLink.search &&
                                !absoluteLink.pathname.match(/\.(jpg|jpeg|png|gif|pdf|zip|xml|css|js)$/i)
                            ) {
                                queue.push(absoluteLink.href);
                            }
                        } catch (e) {}
                    }
                });

            } catch (e: any) {
                console.error(`[Error] Ошибка на ${currentUrl}: ${e.message}`);
            }
        }));

        // Пауза 300мс между пачками для стабильности
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`\n[Crawl] Полный обход сайта завершен!`);
    console.log(`[Crawl] Всего страниц исследовано: ${visitedUrls.size}`);
    console.log(`[Crawl] Всего уникальных картинок найдено: ${foundImages.size}\n`);

    return Array.from(foundImages);
}