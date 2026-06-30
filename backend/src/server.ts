import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { URL } from 'url';
import { crawlQueue } from './queue.js'; // Импортируем нашу очередь

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.get('/api/crawl-stream', async (req: Request, res: Response): Promise<any> => {
    const url = req.query.url as string;
    if (!url) return res.status(400).send('URL is required');

    try { new URL(url); } catch (e) { return res.status(400).json({ error: 'Некорректный формат URL' }) }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });

    // 1. Вместо запуска краулера, мы просто пинаем Redis: "Эй, добавь сайт в очередь!"
    // BullMQ сгенерирует уникальный ID задачи (например, "1")
    const job = await crawlQueue.add('crawl-job', { url });
    console.log(`[Server] Создана задача в Redis с ID: ${job.id}`);

    // 2. Нам нужно передавать прогресс этой задачи на фронтенд в реальном времени.
    // Напишем интервал, который будет раз в секунду проверять статус нашей задачи в Redis
    const intervalId = setInterval(async () => {
        // Получаем свежий статус задачи из Redis по её ID
        const currentJob = await crawlQueue.getJob(job.id!);

        if (!currentJob) return;

        // Смотрим, какой прогресс записал наш Worker
        const progress = currentJob.progress;
        if (progress) {
            res.write(`data: ${JSON.stringify(progress)}\n\n`);
        }

        // Если воркер завершил работу
        if (await currentJob.isCompleted()) {
            const result = currentJob.returnvalue; // Забираем итоговые картинки
            res.write(`data: ${JSON.stringify({ type: 'done', images: result.images })}\n\n`);
            clearInterval(intervalId);
            res.end();
        }

        // Если произошла ошибка
        if (await currentJob.isFailed()) {
            res.write(`data: ${JSON.stringify({ type: 'error', message: 'Job failed' })}\n\n`);
            clearInterval(intervalId);
            res.end();
        }
    }, 1000); // Проверяем Redis каждую секунду

    // Если пользователь закрыл вкладку/браузер, очищаем интервал,
    // но задача в Redis ВСЁ РАВНО продолжит выполняться в фоне! Сеньор будет доволен.
    req.on('close', () => {
        clearInterval(intervalId);
    });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});