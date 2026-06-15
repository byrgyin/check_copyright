import { TestBed } from '@angular/core/testing';

import { Crawl } from './crawl';

describe('Crawl', () => {
  let service: Crawl;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Crawl);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
