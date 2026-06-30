import { Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Crawl } from './serivce/crawl';
import { ImageResult } from './interface/interface';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ReactiveFormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  standalone: true,
})
export class App {
  protected readonly host = signal<string>('');
  // protected readonly crawlerService = inject(Crawl);
  protected readonly images = signal<ImageResult[]>([]);
  protected readonly statusText = signal<string>('Ready');
  protected readonly progressPercent = signal<number>(0);
  protected readonly isCrawling = signal<boolean>(false);
  protected readonly suspectImagesCount = computed(() => {
    return this.images().filter((img) => !img.isUnique).length;
  });

  // Сигналы для второго прогресс-бара TinEye
  protected readonly isCheckingTinEye = signal<boolean>(false);
  protected readonly tineyeProgressPercent = signal<number>(0);
  protected readonly tineyeStatusText = signal<string>('Ожидание очереди...');

  form = new FormGroup({
    url: new FormControl<string | null>(null, Validators.required),
  });

  downLoadCsv(): void {
    if (this.images().length === 0) {
      alert('No images available');
      return;
    } else {
      // ИСПРАВЛЕНО: Шапка CSV теперь содержит больше полезных данных для отчета
      let csvContent = 'Image URL;Page;Class Html\n';

      this.images().forEach((img) => {
        const status = img.isUnique ? 'Unique' : 'Plagiarism Detected';
        csvContent += `"${img.url}";"${img.pageUrl}";"${img.className}"\n`;
      });

      const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvContent], {
        type: 'text/csv;charset=utf-8;',
      });
      const url: string = URL.createObjectURL(blob);
      const link: HTMLAnchorElement = document.createElement('a');

      let nameSite = 'site';
      const formUrl = this.form?.value?.url;

      if (formUrl) {
        try {
          nameSite = new URL(formUrl).hostname;
          nameSite = nameSite.replace('www.', '');
        } catch (e) {
          console.error('Не удалось распарсить URL для имени файла:', e);
        }
      }

      const now = new Date();
      const dateStr = now
        .toLocaleDateString('en-US', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
        .replace(/\//g, '-');

      link.href = url;
      link.setAttribute('download', `crawler_licenses_${nameSite}_${dateStr}.csv`);

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    }
  }

  onSubmit(event: Event) {
    event.preventDefault();

    if (this.form.valid) {
      const rawUrl = this.form.value.url!;

      // Сразу настраиваем базовые сигналы для визуала
      this.host.set(new URL(rawUrl).hostname.replace('www.', ''));
      this.statusText.set('Scanning...');
      this.progressPercent.set(0);
      this.isCrawling.set(true);

      // Сбрасываем состояние TinEye перед новым поиском
      this.isCheckingTinEye.set(false);
      this.tineyeProgressPercent.set(0);
      this.tineyeStatusText.set('Ожидание очереди...');
      this.images.set([]); // Сбрасываем старые картинки

      const encodedUrl = encodeURIComponent(rawUrl);
      const eventSource = new EventSource(
        `http://localhost:3000/api/crawl-stream?url=${encodedUrl}`,
      );

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // 1. Прогресс обычного краулинга
        if (data.type === 'progress') {
          const processed = data.processed;
          const queueLength = data.queue;

          const total = processed + queueLength;
          const percent = total > 0 ? Math.round((processed / total) * 100) : 0;

          this.progressPercent.set(percent === 100 ? 99 : percent);
        }

        // 2. Сигнал смены этапа: Краулер закончил, бэк переходит к TinEye
        if (data.type === 'status' && data.message === 'Checking licenses with TinEye...') {
          this.statusText.set('Сбор завершен');
          this.progressPercent.set(100); // Жестко фиксируем первый бар на максимуме
          this.isCheckingTinEye.set(true); // Проявляем второй прогресс-бар
          this.tineyeStatusText.set('Запуск анализа API...');
        }

        // 3. Пошаговый прогресс отправки картинок в TinEye
        if (data.type === 'tineye_progress') {
          const percent = Math.round((data.checked / data.total) * 100);
          this.tineyeProgressPercent.set(percent);
          this.tineyeStatusText.set(`Проверено ${data.checked} из ${data.total}`);
        }

        // 4. Финал процесса
        if (data.type === 'done') {
          this.statusText.set('Complete');
          this.tineyeStatusText.set('Проверка завершена');
          this.tineyeProgressPercent.set(100);

          // Скрываем бары загрузки, так как всё готово
          this.isCrawling.set(false);
          this.isCheckingTinEye.set(false);

          // Записываем финальный массив со всеми лицензиями в стейт
          this.images.set(data.images);

          eventSource.close();
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE Error:', error);
        this.statusText.set('Error');
        this.tineyeStatusText.set('Ошибка проверки');
        this.isCrawling.set(false);
        this.isCheckingTinEye.set(false);
        eventSource.close();
      };
    }
  }
}
