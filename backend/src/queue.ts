import { Queue, Worker, Job } from 'bullmq';
import mongoose from 'mongoose';
import { ImageModel } from './models/Image.js';
import { crawlSite } from './crawlSite.js';
import { checkImageLicense } from './service/googleVisionService.js';

// Подключаемся к MongoDB (локальный докер-контейнер)
mongoose.connect('mongodb://localhost:27017/copyright_crawler')
    .then(() => console.log('[Mongo] Успешно подключено к MongoDB'))
    .catch(err => console.error('[Mongo] Ошибка подключения:', err.message));
// 1. Вместо инстанса класса Redis, создаем простой объект конфигурации.
// Типизируем его как 'any' или вообще не типизируем, чтобы у TS не было вопросов.
const redisConfig: any = {
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null // Обязательно оставляем для BullMQ
};

// 2. Передаем объект конфигурации в Queue
export const crawlQueue = new Queue('crawl-tasks', {connection: redisConfig});

// 3. Передаем этот же объект конфигурации в Worker
export const crawlWorker = new Worker('crawl-tasks', async (job: Job) => {
  const { url } = job.data;

  console.log(`[Worker] Начинаем задачу #${job.id} для сайта: ${url}`);

  const rawImages = await crawlSite(url, async (processed, queueLength) => {
    await job.updateProgress({
      type: 'progress',
      processed,
      queue: queueLength
    });
  });

  console.log(`[Worker] Краулинг завершен для #${job.id}. Найдено уникальных картинок: ${rawImages.length}`);

  await job.updateProgress({ type: 'status', message: 'Checking licenses with TinEye...' });

  const checkedImages = [];

  for (let i = 0; i < rawImages.length; i++) {
    const imageInfo = rawImages[i];
    if (!imageInfo) continue;

    // --- УМНАЯ ЛОГИКА С MONGO ---
    // 1. Ищем картинку в нашей БД по её URL

    const cachedImage = await ImageModel.findOne({ url: imageInfo.url });

    if(cachedImage){
      console.log(`[Mongo] Найдено в кэше базы данных: ${imageInfo.url}`);
      checkedImages.push({
        url: cachedImage.url,
        pageUrl: imageInfo.pageUrl, // страницу и класс берем текущие, где она нашлась
        className: imageInfo.className,
        totalMatches: cachedImage.totalMatches,
        isUnique: cachedImage.isUnique,
        domains: cachedImage.domains
      });
    } else {
      console.log(`[Google Cloud Vison API] Новая картинка. Запрос к API: ${imageInfo.url}`);

      const result = await checkImageLicense(imageInfo);
      checkedImages.push(result);

      try {
        await ImageModel.create(result)
      } catch (dbErr) {}
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    await job.updateProgress({
      type: 'tineye_progress',
      checked: i + 1,
      total: rawImages.length
    });

  }

  return { images: checkedImages };
}, {connection: redisConfig});

crawlWorker.on('completed', (job) => {
  console.log(`[Worker] Задача #${job.id} успешно выполнена!`);
});

crawlWorker.on('failed', (job, err) => {
  console.error(`[Worker] Задача #${job?.id} провалилась:`, err.message);
});