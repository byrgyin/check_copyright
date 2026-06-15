import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';

type ProgressCallback = (processedCount: number, queueLength: number) => void;

const getLinksFromSitemap = async (baseUrlObj: URL): Promise<string[]> => {
    const sitemapUrl = `${baseUrlObj.origin}/sitemap.xml`;
    const sitemapLinks: string[] = [];

    try {
        console.log(`[Sitemap] Проверяем наличие карты сайта: ${sitemapUrl}`);
        const { data: xml } = await axios.get(sitemapUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MyAngularCrawler/2.0)' },
            timeout: 5000 // Таймаут 5 секунд на получение карты сайта
        });

        // Загружаем XML в cheerio с флагом xml: true для корректного парсинга XML-структуры
        const $ = cheerio.load(xml, { xml: true });

        // В sitemap.xml все адреса страниц хранятся внутри тегов <loc>
        $('loc').each((_, element) => {
            const url = $(element).text().trim();
            if (url) {
                sitemapLinks.push(url);
            }
        });

        console.log(`[Sitemap] Успешно! Найдено страниц в карте сайта: ${sitemapLinks.length}`);
    } catch (e) {
        console.log(`[Sitemap] Карта сайта не найдена или недоступна. Переключаемся на рекурсивный обход.`);
    }

    return sitemapLinks;
}


export const crawlSite = async (startUrl: string, onProgress?: ProgressCallback): Promise<string[]> => {
    const visitedUrls = new Set<string>();
    const foundImages = new Set<string>();

    const startUrlObj: URL = new URL(startUrl);
    const baseDomain: string = startUrlObj.hostname;

    // ШАГ 1: Сканируем карту сайта sitemap.xml перед запуском основного цикла
    const sitemapLinks = await getLinksFromSitemap(startUrlObj);

    // Флаг, определяющий, используем ли мы карту сайта.
    // Если ссылки в ней нашлись — значит мы работаем в режиме карты сайта, рекурсия не нужна.
    const isSitemapMode = sitemapLinks.length > 0;

    // Инициализируем очередь:
    // Если sitemap найден — закидываем туда все ссылки из карты сайта.
    // Если sitemap не найден — кладем в очередь только стартовый URL для рекурсивного обхода.
    const queue: string[] = isSitemapMode ? sitemapLinks : [startUrl];

    const CONCURRENCY_LIMIT = 5;

    // Главный цикл обхода очереди
    while (queue.length > 0) {

        const chunk = queue.splice(0, CONCURRENCY_LIMIT);
        const urlsToProcess = chunk.filter(url => !visitedUrls.has(url));

        if (urlsToProcess.length === 0) continue;

        urlsToProcess.forEach(url => visitedUrls.add(url));

        await Promise.all(urlsToProcess.map(async (currentUrl) => {
            console.log(`[Crawl] Режим: ${isSitemapMode ? 'Sitemap' : 'Рекурсия'} | Обработано: ${visitedUrls.size} | В очереди: ${queue.length} | Текущая: ${currentUrl}`);

            try {
                const { data: html } = await axios.get(currentUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MyAngularCrawler/2.0)' },
                    timeout: 6000
                });

                const $ = cheerio.load(html);

                // 1. Сбор картинок (выполняется всегда, независимо от режима обхода)
                $('img').each((_, element) => {
                    const src: string | undefined = $(element).attr('src');
                    if (src) {
                        try {
                            const absoluteImgURl = new URL(src, currentUrl).href;
                            foundImages.add(absoluteImgURl);
                        } catch (e) {}
                    }
                });

                // 2. Сбор ссылок для продолжения обхода (только если sitemap.xml НЕ НАШЛАСЬ)
                if (!isSitemapMode) {
                    $('a').each((_, element) => {
                        const href: string | undefined = $(element).attr('href');
                        if (href) {
                            try {
                                const absoluteLink = new URL(href, currentUrl);
                                absoluteLink.hash = '';

                                if (
                                    absoluteLink.hostname === baseDomain &&
                                    !visitedUrls.has(absoluteLink.href) &&
                                    !queue.includes(absoluteLink.href) &&
                                    !absoluteLink.search &&
                                    !absoluteLink.pathname.match(/\.(jpg|jpeg|png|gif|pdf|zip|xml|css|js)$/i)
                                ) {
                                    queue.push(absoluteLink.href);
                                }
                            } catch (e) {}
                        }
                    });
                }

            } catch (e: any) {
                console.error(`[Error] Ошибка на ${currentUrl}: ${e.message}`);
            }
        }));

        if (onProgress) {
            onProgress(visitedUrls.size, queue.length);
        }
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`\n[Crawl] Полный обход сайта завершен!`);
    console.log(`[Crawl] Всего страниц исследовано: ${visitedUrls.size}`);
    console.log(`[Crawl] Всего уникальных картинок найдено: ${foundImages.size}\n`);

    return Array.from(foundImages);
}