import express, {type Request, type Response } from 'express';
import cors from 'cors';
import { URL } from 'url';
import {crawlSite} from "./crawlSite.js";

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
    } catch (e){
        return res.status(400).json({error: 'Некорректный формат URL'})
    }
    // НАСТРОЙКА SSE: Устанавливаем заголовки для потоковой передачи данных
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });

    console.log(`=== Старт краулинга для: ${url} ===`);

    const images = await crawlSite(url, (processed, queue) => {
        // Формат SSE требует обязательного префикса "data: " и двух переносов строки "\n\n" в конце
        res.write(`data: ${JSON.stringify({ type: 'progress', processed, queue })}\n\n`);
    });

    console.log(`=== Финиш потокового краулинга для: ${url} ===`);

    res.write(`data: ${JSON.stringify({ type: 'done', images })}\n\n`);
    res.end();
});

app.listen(PORT, () => {
    console.log(`Сервер краулера запущен на http://localhost:${PORT}`);
});