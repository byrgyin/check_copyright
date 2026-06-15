import express, {type Request, type Response } from 'express';
import cors from 'cors';
import { URL } from 'url';
import {crawlSite} from "./crawlSite.js";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.post('/api/crawl', async (req: Request, res: Response) => {
    const { url } = req.body;
    if (!url) {
        console.log(url)
        return res.status(400).send('URL is required');
    }
    try {
        new URL(url);
    } catch (e){
        return res.status(400).json({error: 'Некорректный формат URL'})
    }
    console.log(`=== Старт краулинга для: ${url} ===`);
    const images:string[] = await crawlSite(url);
    console.log(`=== Финиш краулинга для: ${url} ===`);
    return res.json({
        status: 'success',
        targetUrl: url,
        images: images
    })
});

app.listen(PORT, () => {
    console.log(`Сервер краулера запущен на http://localhost:${PORT}`);
});