import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { URL } from 'url';
import { crawlSite } from "./crawlSite.js";
import { checkImageLicense } from "./tineyeService.js";
// ИСПРАВЛЕНО: Импортируем правильный тип интерфейса, который ожидает фронтенд и отдает сервис
import type { ImageResult } from "./interface/interface.js";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.get('/api/crawl-stream', async (req: Request, res: Response): Promise<any> => {
    const url = req.query.url as string;
    if (!url) {
        return res.status(400).send('URL is required');
    }
    try {
        new URL(url);
    } catch (e) {
        return res.status(400).json({ error: 'Некорректный формат URL' })
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });

    console.log(`=== Старт краулинга для: ${url} ===`);

    const rawImages = await crawlSite(url, (processed, queue) => {
        res.write(`data: ${JSON.stringify({ type: 'progress', processed, queue })}\n\n`);
    });

    console.log(`=== Краулинг завершен. Найдено ${rawImages.length} картинок. Начинаем проверку TinEye ===`);
    res.write(`data: ${JSON.stringify({ type: 'status', message: 'Checking licenses with TinEye...' })}\n\n`);

    // ИСПРАВЛЕНО: Применяем верный тип ImageResult
    const checkedImages: ImageResult[] = [];

    // 2. Этап проверки картинок
    for (let i = 0; i < rawImages.length; i++) {
        const imageInfo = rawImages[i];

        if (!imageInfo) continue;

        // ИСПРАВЛЕНО: Явно обращаемся к .url, чтобы в консоли выводилась ссылка, а не [object Object]
        console.log(`[TinEye] Проверяем (${i + 1}/${rawImages.length}): ${imageInfo.url}`);

        // Передаем объект целиком — внутри него лежат url, pageUrl и className
        const result = await checkImageLicense(imageInfo);
        checkedImages.push(result);

        res.write(`data: ${JSON.stringify({
            type: 'tineye_progress',
            checked: i + 1,
            total: rawImages.length
        })}\n\n`);

        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`=== Проверка TinEye успешно завершена! ===`);

    res.write(`data: ${JSON.stringify({ type: 'done', images: checkedImages })}\n\n`);
    res.end();
});

app.listen(PORT, () => {
    console.log(`Сервер краулера запущен на http://localhost:${PORT}`);
});