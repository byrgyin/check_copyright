import type { Document } from 'mongoose';
export interface RawImageFound {
    url: string;
    pageUrl: string;
    className: string;
}
export interface ImageResult {
    url: string; // Ссылка на саму картинку
    pageUrl: string; // Страница, где краулер её нашёл
    className: string; // Класс картинки или её родителя
    totalMatches: number;
    isUnique: boolean;
    domains: string[];
}

export interface IImageDocument extends Document {
    url: string;
    pageUrl: string;
    className: string;
    totalMatches: number;
    isUnique: boolean;
    domains: string[];
    createdAt: Date;
}