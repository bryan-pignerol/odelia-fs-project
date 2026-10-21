import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { BoardListComponent } from './board-list.component';

describe('BoardListComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BoardListComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('displays boards returned for the user, including boards shared by another owner', () => {
    const fixture = TestBed.createComponent(BoardListComponent);
    fixture.detectChanges();

    const request = http.expectOne('/api/boards');
    expect(request.request.method).toBe('GET');
    request.flush([
      { id: 1, name: 'My board', owner: 'alice' },
      { id: 2, name: 'Shared board', owner: 'bob' }
    ]);
    fixture.detectChanges();

    const content = fixture.nativeElement.textContent as string;
    expect(content).toContain('My board');
    expect(content).toContain('Shared board');
    expect(content).toContain('bob');
  });
});
