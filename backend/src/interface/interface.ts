export interface RawImageFound {
    url: string;
    pageUrl: string;
    className: string;
}

export interface CheckedImage {
    url: string;
    totalMatches: number;
    isUnique: boolean;
    domains: string[];
}
export interface ImageResult {
    url: string; // Ссылка на саму картинку
    pageUrl: string; // Страница, где краулер её нашёл
    className: string; // Класс картинки или её родителя
    totalMatches: number;
    isUnique: boolean;
    domains: string[];
}