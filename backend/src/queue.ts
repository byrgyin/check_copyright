import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { crawlSite } from './crawlSite.js';
import { checkImageLicense } from './tineyeService.js';