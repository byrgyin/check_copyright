export interface crawlerService {
  success: boolean;

  totalImages: number;

  images: string[];
}
export interface ImageResult {
  url: string; // Ссылка на саму картинку
  pageUrl: string; // Страница, где краулер её нашёл
  className: string; // Класс картинки или её родителя
  totalMatches: number;
  isUnique: boolean;
  domains: string[];
}
