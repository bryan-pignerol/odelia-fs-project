import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';

import { BoardListComponent } from './board-list.component';
import { AuthService } from '../auth/auth.service';

describe('BoardListComponent', () => {
  let http: HttpTestingController;
  let admin = false;

  beforeEach(async () => {
    admin = false;
    await TestBed.configureTestingModule({
      imports: [BoardListComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: { username: signal('alice'), isAdmin: () => admin } }
      ]
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
    expect(fixture.nativeElement.querySelectorAll('button.danger').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.board-list .board:nth-child(2) button.danger')).toBeNull();
  });

  it('shows delete controls to an admin for boards they do not own', () => {
    const fixture = TestBed.createComponent(BoardListComponent);
    fixture.detectChanges();

    http.expectOne('/api/boards').flush([
      { id: 2, name: 'Shared board', owner: 'bob' }
    ]);
    admin = true;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('button.danger').length).toBe(1);
  });
});
