import { Queue, Worker, Job } from 'bullmq';
import { crawlSite } from './crawlSite.js';
import { checkImageLicense } from './tineyeService.js';

// 1. Вместо инстанса класса Redis, создаем простой объект конфигурации.
// Типизируем его как 'any' или вообще не типизируем, чтобы у TS не было вопросов.
const redisConfig: any = {
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null // Обязательно оставляем для BullMQ
};

// 2. Передаем объект конфигурации в Queue
export const crawlQueue = new Queue('crawl-tasks', {
  connection: redisConfig
});

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

    const result = await checkImageLicense(imageInfo);
    checkedImages.push(result);

    await job.updateProgress({
      type: 'tineye_progress',
      checked: i + 1,
      total: rawImages.length
    });

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return { images: checkedImages };
}, {
  connection: redisConfig // И сюда тоже отдаем объект настроек
});

crawlWorker.on('completed', (job) => {
  console.log(`[Worker] Задача #${job.id} успешно выполнена!`);
});

crawlWorker.on('failed', (job, err) => {
  console.error(`[Worker] Задача #${job?.id} провалилась:`, err.message);
});