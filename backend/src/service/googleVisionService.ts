import vision from '@google-cloud/vision';
import fs from 'fs';
import path from 'path';
import type {RawImageFound, ImageResult} from "../interface/interface.js";

const keyPath = path.resolve(process.cwd(), 'animated-origin-501212-j6-f845b3ecbd44.json');

// 2. Читаем и парсим JSON-ключ
const keyFile = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

// 3. Инициализируем клиент, передавая данные напрямую в обход системных поисков Google
const client = new vision.ImageAnnotatorClient({
    credentials: {
        client_email: keyFile.client_email,
        private_key: keyFile.private_key,
    },
    projectId: keyFile.project_id,
    fallback: true
});

export const checkImageLicense = async (image: RawImageFound):Promise<ImageResult> => {
    try {
        const [result] = await client.webDetection(image.url)
        const wedDetection = result.webDetection;

        const fullMatches = wedDetection?.fullMatchingImages || [];
        const partialMatches = wedDetection?.partialMatchingImages || [];
        const pagesWithMatches = wedDetection?.pagesWithMatchingImages || [];

        const totalMatches = fullMatches.length + partialMatches.length;

        const isUnique = totalMatches === 0;

        const domains:string[] = [];

        if (pagesWithMatches.length > 0) {
            pagesWithMatches.forEach((page) => {
                if (page.url){
                    try {
                        const domain = new URL(page.url).hostname;
                        if (!domains.includes(domain)) {
                            domains.push(domain);
                        }
                    } catch (e) {

                    }
                }
            });
        }
        return {
            url: image.url,
            pageUrl: image.pageUrl,
            className: image.className,
            totalMatches: totalMatches,
            isUnique: isUnique,
            domains: domains
        };
    } catch (error: any) {
        console.error(`[Google Vision Error] Ошибка проверки картинки ${image.url}:`, error.message);
        return {
            url: image.url,
            pageUrl: image.pageUrl,
            className: image.className,
            totalMatches: 0,
            isUnique: true,
            domains: []
        };
    }
};