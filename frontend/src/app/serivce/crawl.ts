import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {crawlerService} from '../interface/interface';

@Injectable({
  providedIn: 'root',
})
export class Crawl {
  http: HttpClient = inject(HttpClient);

  baseURL: string = 'http://localhost:3000';

  postURL(body:{url:string}): Observable<crawlerService>{
    // @ts-ignore
    return this.http.post(`${this.baseURL}/api/crawl`, body);
  }
}
