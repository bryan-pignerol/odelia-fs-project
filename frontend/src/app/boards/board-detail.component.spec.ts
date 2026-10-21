import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { signal } from '@angular/core';

import { BoardDetailComponent } from './board-detail.component';
import { AuthService } from '../auth/auth.service';

describe('BoardDetailComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BoardDetailComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { username: signal('alice') } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['id', '7']]) } } }
      ]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function flushMembers(members: { id: number; boardId: number; username: string }[] = []): void {
    const request = http.expectOne('/api/boards/7/members');
    expect(request.request.method).toBe('GET');
    request.flush(members);
  }

  it('loads the board and its columns on init', () => {
    const fixture = TestBed.createComponent(BoardDetailComponent);
    fixture.detectChanges();

    http.expectOne('/api/boards/7').flush({ id: 7, name: 'Sprint 1' });
    flushMembers([{ id: 3, boardId: 7, username: 'bob' }]);

    const listsReq = http.expectOne('/api/boards/7/lists');
    listsReq.flush([{ id: 1, boardId: 7, name: 'To do', position: 0 }]);

    http.expectOne('/api/lists/1/cards').flush([
      { id: 10, listId: 1, title: 'First card', position: 0 }
    ]);
    fixture.detectChanges();

    expect(fixture.componentInstance.board()?.name).toBe('Sprint 1');
    expect(fixture.componentInstance.cardsFor(1).length).toBe(1);
    expect(fixture.componentInstance.members().map(member => member.username)).toEqual(['bob']);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('bob');
  });

  it('lets the owner add a member and shows the new member', () => {
    const fixture = TestBed.createComponent(BoardDetailComponent);
    fixture.detectChanges();

    http.expectOne('/api/boards/7').flush({ id: 7, name: 'Sprint 1', owner: 'alice' });
    flushMembers();
    http.expectOne('/api/boards/7/lists').flush([]);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#new-member-username') as HTMLInputElement;
    expect(input).not.toBeNull();
    fixture.componentInstance.newMemberUsername = ' bob ';
    fixture.componentInstance.addMember();

    const post = http.expectOne('/api/boards/7/members');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ username: 'bob' });
    post.flush({ id: 4, boardId: 7, username: 'bob' });
    fixture.detectChanges();

    expect(fixture.componentInstance.members().map(member => member.username)).toEqual(['bob']);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('bob');
    expect(fixture.componentInstance.newMemberUsername).toBe('');
  });

  it('lets the owner remove a member', () => {
    const fixture = TestBed.createComponent(BoardDetailComponent);
    fixture.detectChanges();

    http.expectOne('/api/boards/7').flush({ id: 7, name: 'Sprint 1', owner: 'alice' });
    flushMembers([{ id: 4, boardId: 7, username: 'bob' }]);
    http.expectOne('/api/boards/7/lists').flush([]);
    fixture.detectChanges();

    fixture.componentInstance.removeMember(fixture.componentInstance.members()[0]);
    const remove = http.expectOne('/api/boards/7/members/bob');
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
    fixture.detectChanges();

    expect(fixture.componentInstance.members()).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('bob');
  });

  it('does not show membership controls to a non-owner', () => {
    const fixture = TestBed.createComponent(BoardDetailComponent);
    fixture.detectChanges();

    http.expectOne('/api/boards/7').flush({ id: 7, name: 'Sprint 1', owner: 'alice' });
    flushMembers([{ id: 4, boardId: 7, username: 'bob' }]);
    http.expectOne('/api/boards/7/lists').flush([]);
    TestBed.inject(AuthService).username.set('bob');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#new-member-username')).toBeNull();
    expect(fixture.nativeElement.querySelector('.remove-member')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('bob');
  });

  it('PATCHes the card when it is dropped into another column', () => {
    const fixture = TestBed.createComponent(BoardDetailComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    http.expectOne('/api/boards/7').flush({ id: 7, name: 'Sprint 1' });
    flushMembers();
    http.expectOne('/api/boards/7/lists').flush([
      { id: 1, boardId: 7, name: 'To do', position: 0 },
      { id: 2, boardId: 7, name: 'Doing', position: 1 }
    ]);
    http.expectOne('/api/lists/1/cards').flush([{ id: 10, listId: 1, title: 'Card', position: 0 }]);
    http.expectOne('/api/lists/2/cards').flush([]);

    const card = component.cardsFor(1)[0];
    component.drop({
      item: { data: card },
      container: { data: { id: 2 } },
      previousContainer: { data: { id: 1 } },
      previousIndex: 0,
      currentIndex: 0
    } as never);

    const move = http.expectOne('/api/cards/10/move');
    expect(move.request.method).toBe('PATCH');
    expect(move.request.body).toEqual({ targetListId: 2, position: 0 });
    move.flush({ id: 10, listId: 2, title: 'Card', position: 0 });

    expect(component.cardsFor(1).length).toBe(0);
    expect(component.cardsFor(2).length).toBe(1);
  });

  it('PUTs the card and updates it in place when the inline editor is saved', () => {
    const fixture = TestBed.createComponent(BoardDetailComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    http.expectOne('/api/boards/7').flush({ id: 7, name: 'Sprint 1' });
    flushMembers();
    http.expectOne('/api/boards/7/lists').flush([
      { id: 1, boardId: 7, name: 'To do', position: 0 }
    ]);
    http.expectOne('/api/lists/1/cards').flush([
      { id: 10, listId: 1, title: 'Card', position: 0 }
    ]);

    const card = component.cardsFor(1)[0];
    component.startEdit(card);
    expect(component.editingCardId()).toBe(10);

    component.editDraft.title = 'Card renamed';
    component.editDraft.description = 'Now with details';
    component.saveEdit(card);

    const put = http.expectOne('/api/cards/10');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ title: 'Card renamed', description: 'Now with details' });
    put.flush({ id: 10, listId: 1, title: 'Card renamed', description: 'Now with details', position: 0 });

    expect(component.editingCardId()).toBeNull();
    expect(component.cardsFor(1)[0].description).toBe('Now with details');
  });

  it('opens and closes the "add a card" composer one column at a time', () => {
    const fixture = TestBed.createComponent(BoardDetailComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    http.expectOne('/api/boards/7').flush({ id: 7, name: 'Sprint 1' });
    flushMembers();
    http.expectOne('/api/boards/7/lists').flush([
      { id: 1, boardId: 7, name: 'To do', position: 0 }
    ]);
    http.expectOne('/api/lists/1/cards').flush([]);

    expect(component.composingColumnId()).toBeNull();

    component.startComposing(1);
    expect(component.composingColumnId()).toBe(1);

    component.cancelComposing();
    expect(component.composingColumnId()).toBeNull();
  });

  it('POSTs title and description from the "add a card" form', () => {
    const fixture = TestBed.createComponent(BoardDetailComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    http.expectOne('/api/boards/7').flush({ id: 7, name: 'Sprint 1' });
    flushMembers();
    http.expectOne('/api/boards/7/lists').flush([
      { id: 1, boardId: 7, name: 'To do', position: 0 }
    ]);
    http.expectOne('/api/lists/1/cards').flush([]);

    const column = component.columns()[0];
    const draft = component.draftFor(1);
    draft.title = 'New card';
    draft.description = 'With a description';
    component.addCard(column);

    const post = http.expectOne('/api/lists/1/cards');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ title: 'New card', description: 'With a description' });
    post.flush({ id: 20, listId: 1, title: 'New card', description: 'With a description', position: 0 });

    expect(component.cardsFor(1).length).toBe(1);
    expect(draft.title).toBe('');
    expect(draft.description).toBe('');
  });
});
