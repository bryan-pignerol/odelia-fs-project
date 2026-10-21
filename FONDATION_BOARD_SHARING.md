# Exercice 17 — Rapport : Board Sharing (BoardMember)

## Livrables

### 1. Entité `BoardMember` — R1, R10

**Fichier** : `backend/.../entity/BoardMember.java` (créé)

Table `BOARD_MEMBER(boardId, username)` avec contrainte d'unicité. Le owner n'y est
pas stocké — `Board.owner` suffit. Référence par `boardId`, pas de `@ManyToOne`.

### 2. Repository `BoardMemberRepository` — R1, prépare R3-R6

**Fichier** : `backend/.../repository/BoardMemberRepository.java` (créé)

5 méthodes : `findByBoardIdOrderByUsernameAsc`, `findByUsernameOrderByBoardIdAsc`,
`existsByBoardIdAndUsername`, `deleteByBoardIdAndUsername`, `deleteByBoardId`.

### 3. `BoardAccess` modifié — R7, R8, R9

**Fichier** : `backend/.../security/BoardAccess.java` (modifié)

Deux niveaux d'accès :
- `requireBoardAccess(board)` → owner + member + admin (R7)
- `requireOwnerOnly(board)` → owner + admin, membres exclus (R8)

`requireColumnAccess` / `requireCardAccess` délèguent à `requireBoardAccess`.

### 4. Endpoints membership dans `BoardResource` — R2, R3, R4, R5, R10

**Fichier** : `backend/.../resource/BoardResource.java` (modifié)

Trois nouveaux endpoints + un DTO `AddMemberRequest` :

| Méthode | Endpoint | Accès | Validations |
|---|---|---|---|
| `POST` | `/api/boards/{id}/members` | Owner/admin (`requireOwnerOnly`) | 400 si username = owner (R10), 400 si déjà membre (R5) |
| `GET` | `/api/boards/{id}/members` | Owner/member/admin (`requireBoardAccess`) | — |
| `DELETE` | `/api/boards/{id}/members/{username}` | Owner/admin (`requireOwnerOnly`) | 400 si username = owner (R10) |

La suppression (R4) prend effet immédiatement : `deleteByBoardIdAndUsername` supprime
la ligne, le prochain appel du membre retiré passera par `requireBoardAccess` et
échouera avec 403.

### 5. Owner-only sur rename/delete + nettoyage cascade — R8, R4

**Fichier** : `backend/.../resource/BoardResource.java` (modifié)

- Nouvelle méthode privée `ownedBoard(id)` qui appelle `access.requireOwnerOnly(board)`.
- `updateBoard()` (PUT rename) passe de `accessibleBoard` à `ownedBoard` → un membre reçoit 403.
- `deleteBoard()` (DELETE) passe de `accessibleBoard` à `ownedBoard` → un membre reçoit 403.
- `deleteBoard()` appelle `members.deleteByBoardId(id)` avant de supprimer le board,
  pour nettoyer les lignes `BOARD_MEMBER` orphelines.

`accessibleBoard()` (avec `requireBoardAccess`) reste utilisée pour `getBoard`,
`listColumns`, `addColumn` — actions ouvertes aux membres (R7).

### 6. `GET /api/boards` retourne owned + membre — R6

**Fichiers** : `backend/.../repository/BoardRepository.java` (modifié), `backend/.../resource/BoardResource.java` (modifié)

- Nouvelle méthode `findOwnedOrMember(String username)` dans `BoardRepository`,
  avec une requête JPQL explicite (le query-by-method-name ne peut pas exprimer
  un OR avec sous-requête) :
  ```sql
  SELECT b FROM Board b WHERE b.owner = ?1
    OR b.id IN (SELECT m.boardId FROM BoardMember m WHERE m.username = ?1)
  ```
- `listBoards()` appelle `findOwnedOrMember(currentUser.name())` pour un user
  non-admin. L'admin continue de voir tous les boards via `findAllSortedByName()`.

## Edge case considéré

Un membre tente une action owner-only (rename, delete, add/remove member) :
`requireOwnerOnly` est appelée, le membre n'est ni owner ni admin → `ForbiddenException`
→ 403 avec message explicite. Pas de 404 (qui divulguerait l'existence du board).

## Récapitulatif

| Fichier | Action | Reqs |
|---|---|---|
| `entity/BoardMember.java` | Créé | R1, R10 |
| `repository/BoardMemberRepository.java` | Créé | R1, R3, R4, R5, R6 |
| `repository/BoardRepository.java` | Modifié | R6 |
| `security/BoardAccess.java` | Modifié | R7, R8, R9 |
| `resource/BoardResource.java` | Modifié | R2, R3, R4, R5, R6, R8, R10 |