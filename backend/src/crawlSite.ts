import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import type { ProgressCallback } from "./interface/types.js";
import type {RawImageFound} from "./interface/interface.js";

const getLinksFromSitemap = async (baseUrlObj: URL): Promise<string[]> => {
    const sitemapUrl = `${baseUrlObj.origin}/sitemap.xml`;
    const sitemapLinks: string[] = [];

    try {
        console.log(`[Sitemap] Проверяем наличие карты сайта: ${sitemapUrl}`);
        const { data: xml } = await axios.get(sitemapUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MyAngularCrawler/2.0)' },
            timeout: 5000
        });

        const $ = cheerio.load(xml, { xml: true });

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

// Изменили возвращаемый тип с Promise<string[]> на Promise<RawImageFound[]>
export const crawlSite = async (startUrl: string, onProgress?: ProgressCallback): Promise<RawImageFound[]> => {
    const visitedUrls = new Set<string>();

    // Массив для хранения итоговых объектов картинок
    const foundImages: RawImageFound[] = [];
    // Set для дедупликации (чтобы не дублировать одинаковые картинки с одинаковым классом на одной странице)
    const uniqueImagesTracker = new Set<string>();

    const startUrlObj: URL = new URL(startUrl);
    const baseDomain: string = startUrlObj.hostname;

    const sitemapLinks = await getLinksFromSitemap(startUrlObj);
    const isSitemapMode = sitemapLinks.length > 0;
    const queue: string[] = isSitemapMode ? sitemapLinks : [startUrl];

    const CONCURRENCY_LIMIT = 5;

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

                // 1. Сбор картинок с расширенным анализом DOM-структуры
                $('img').each((_, element) => {
                    const imgNode = $(element);
                    const src: string | undefined = imgNode.attr('src');

                    if (src) {
                        try {
                            const absoluteImgURl = new URL(src, currentUrl).href;

                            // ХИТРОСТЬ: Проверяем ТОЛЬКО URL картинки.
                            // Если мы её уже видели на другой странице — полностью игнорируем.
                            if (!uniqueImagesTracker.has(absoluteImgURl)) {
                                uniqueImagesTracker.add(absoluteImgURl);

                                // Поиск класса (выполняется только ОДИН раз для первой найденной картинки)
                                let finalClass = imgNode.attr('class') || '';

                                if (!finalClass.trim()) {
                                    const parentWithClass = imgNode.parents('[class]').first();
                                    if (parentWithClass.length > 0) {
                                        finalClass = parentWithClass.attr('class') || '';
                                    }
                                }

                                finalClass = finalClass.trim().replace(/\s+/g, ' ');
                                if (!finalClass) finalClass = 'no-class';

                                // Добавляем в массив
                                foundImages.push({
                                    url: absoluteImgURl,
                                    pageUrl: currentUrl, // Это будет ПЕРВАЯ страница, где она нашлась
                                    className: finalClass
                                });
                            }
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
    console.log(`[Crawl] Всего уникальных картинок найдено: ${foundImages.length}\n`);

    return foundImages;
}