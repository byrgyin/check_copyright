// Используем require, так как официальная библиотека написана на CommonJS
import TinEye from 'tineye-api';
import type {ImageResult} from "../interface/interface.js";

// Используем тестовый ключ из обновленной документации (v2.0.0+)
const apiKey = "6mm60lsCNIBqFwOWjJqA80QZHh9BMwc-ber4u=t^";
const api = new TinEye("https://api.tineye.com/rest/", apiKey);


export const checkImageLicense = async (imageInfo: { url: string, pageUrl: string, className: string }): Promise<ImageResult> => {
    let timeoutId: NodeJS.Timeout | undefined; // Переменная для хранения ID таймера

    try {
        const params = { offset: 0, limit: 10, sort: "score", order: "desc" };

        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('API Timeout')), 8000);
        });

        const response: any = await Promise.race([
            api.searchUrl(imageInfo.url, params),
            timeoutPromise
        ]);

        // Очищаем таймер сразу, как только получили успешный ответ
        if (timeoutId) clearTimeout(timeoutId);

        const matchesCount = response.stats.total_results;
        const matchedDomains = response.results.matches
            ? response.results.matches.map((match: any) => match.domain)
            : [];

        return {
            url: imageInfo.url,
            pageUrl: imageInfo.pageUrl,
            className: imageInfo.className,
            totalMatches: matchesCount,
            isUnique: matchesCount === 0,
            domains: Array.from(new Set(matchedDomains))
        };

    } catch (error: any) {
        // Очищаем таймер, если упала ошибка до таймаута
        if (timeoutId) clearTimeout(timeoutId);

        console.error(`[TinEye ОШИБКА] ${imageInfo.url}:`, error.message);
        return {
            url: imageInfo.url,
            pageUrl: imageInfo.pageUrl,
            className: imageInfo.className,
            totalMatches: 0,
            isUnique: true,
            domains: []
        };
    }
}