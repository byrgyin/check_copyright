import {Component, inject, signal} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {Crawl} from './serivce/crawl';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ReactiveFormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly host = signal<string>('');
  protected readonly crawlerService = inject(Crawl);
  protected readonly images = signal<string[]>([]);
  protected readonly statusText = signal<string>('Ready');
  protected readonly progressPercent = signal<number>(0);
  protected readonly isCrawling = signal<boolean>(false);
  protected readonly Suspend_images = signal<string[]>([]);


  form = new FormGroup({
    url: new FormControl<string | null>(null, Validators.required)
  });

  downLoadCsv():void{
    if(this.images().length == 0){
      alert("No images available");
      return;
    } else {
      let csvContent = 'images\n';
      this.images().forEach(url => {
        csvContent += `"${url}"\n`;
      });
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], {
        type: 'text/csv;charset=utf-8;'
      });
      const url:string = URL.createObjectURL(blob);
      const link:HTMLAnchorElement = document.createElement('a');

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
      const dateStr = now.toLocaleDateString('en-US', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).replace(/\//g, '-');

      link.href = url;
      link.setAttribute('download', `crawler_images_${nameSite}_${dateStr}.csv`);

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
      this.images.set([]); // Сбрасываем старые картинки

      // Открываем постоянное соединение с бэкендом (передаем URL прямо в GET-стрим)
      const encodedUrl = encodeURIComponent(rawUrl);
      const eventSource = new EventSource(`http://localhost:3000/api/crawl-stream?url=${encodedUrl}`);

      // Ловим сообщения от сервера
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'progress') {
          // Сервер прислал промежуточные цифры обхода
          const processed = data.processed; // сколько прошли
          const queueLength = data.queue;   // сколько осталось в очереди

          // Считаем плавающий процент
          const total = processed + queueLength;
          const percent = total > 0 ? Math.round((processed / total) * 100) : 0;

          // Обновляем прогресс-бар (но не даем ему показать 100% раньше времени)
          this.progressPercent.set(percent === 100 ? 99 : percent);
        }

        if (data.type === 'done') {
          // Сервер сказал, что всё закончилось и прислал итоговый массив картинок!
          this.statusText.set('Complete');
          this.progressPercent.set(100);
          this.images.set(data.images);

          // Закрываем соединение, поток больше не нужен
          eventSource.close();
        }
      };

      // Ловим критические ошибки (например, бэк упал)
      eventSource.onerror = (error) => {
        console.error('SSE Error:', error);
        this.statusText.set('Error');
        eventSource.close();
      };
    }
  }

}
