# Exercice 17 — Rapport : Fondation Board Sharing (BoardMember)

## Ce qui a été fait

Trois livrables posent la fondation de la fonctionnalité de partage de board :
une entité, un repository, et la logique d'autorisation centralisée.

---

### 1. Entité `BoardMember` — couvre **R1**

**Fichier créé** : `backend/src/main/java/com/odelia/kanban/entity/BoardMember.java`

Nouvelle entité JPA qui enregistre qu'un `username` a accès `MEMBER` à un board donné.

| Champ | Type | Contrainte |
|---|---|---|
| `id` | `Long` | `@Id`, auto-généré (IDENTITY) |
| `boardId` | `long` | `nullable = false` |
| `username` | `String` | `nullable = false`, max 120, `@NotBlank` |

**Choix de conception :**

- **Contrainte d'unicité** sur `(BOARD_ID, USERNAME)` — empêche les doublons au niveau base de données.
- **Le owner n'est pas stocké** comme row `BoardMember` — `Board.owner` répond déjà à cette question. Cela évite une redondance et garantit que la relation owner est représentée une seule fois (conforme à R1 et R10).
- **Pas de `@ManyToOne`** — le board est référencé par `boardId`, comme `BoardList` et `Card` dans le projet existant. Les repositories Jakarta Data restent simples et le JSON reste plat.

---

### 2. Repository `BoardMemberRepository` — prépare **R1, R3, R4, R5, R6**

**Fichier créé** : `backend/src/main/java/com/odelia/kanban/repository/BoardMemberRepository.java`

Repository Jakarta Data (`@Repository(dataStore = "jdbc/kanban")`), toutes les méthodes en "query by method name" :

| Méthode | Exigence préparée |
|---|---|
| `findByBoardIdOrderByUsernameAsc(long boardId)` | **R3** — lister les membres d'un board |
| `findByUsernameOrderByBoardIdAsc(String username)` | **R6** — trouver les boards dont l'utilisateur est membre |
| `existsByBoardIdAndUsername(long boardId, String username)` | **R5** — détecter un doublon avant insertion |
| `deleteByBoardIdAndUsername(long boardId, String username)` | **R4** — supprimer un membre (effet immédiat) |
| `deleteByBoardId(long boardId)` | Nettoyage en cascade quand un board est supprimé |

---

### 3. `BoardAccess` modifié — couvre **R7, R8, R9**

**Fichier modifié** : `backend/src/main/java/com/odelia/kanban/security/BoardAccess.java`

C'est le cœur du système d'autorisation. La modification introduit **deux niveaux d'accès** distincts :

| Méthode | Qui passe ? | Usage |
|---|---|---|
| `requireBoardAccess(Board)` | **owner + member + admin** | Ouvrir le board, lister/modifier colonnes et cartes (**R7**) |
| `requireOwnerOnly(Board)` | **owner + admin** (membres exclus) | Renommer le board, le supprimer, gérer les membres (**R8**) |

**Choix de conception :**

- **Séparation owner-only / collaborateur** : la distinction est centralisée dans `BoardAccess` plutôt que dispersée dans chaque ressource. Une ressource qui veut restreindre au owner appelle `requireOwnerOnly()` ; une ressource ouverte aux collaborateurs appelle `requireBoardAccess()`.
- **`requireColumnAccess()` et `requireCardAccess()`** continuent de déléguer à `requireBoardAccess()` — un membre peut donc manipuler les colonnes et cartes d'un board partagé, sans intervention supplémentaire dans `BoardListResource` ou `CardResource` (R7).
- **Admin bypass** : les deux méthodes laissent passer l'admin en premier, comme avant.
- **Refus par défaut** : quelqu'un sans relation (ni owner, ni member, ni admin) reçoit un `403` via `requireBoardAccess()` (R9).
- **`requireOwnerOnly()`** jette un `403` pour un membre, ce qui garantit R8 (pas de `404` ni `500`).

---

## Récapitulatif

| Fichier | Action | Exigences couvertes / préparées |
|---|---|---|
| `backend/.../entity/BoardMember.java` | Créé | R1, R10 |
| `backend/.../repository/BoardMemberRepository.java` | Créé | R1, R3, R4, R5, R6 |
| `backend/.../security/BoardAccess.java` | Modifié | R7, R8, R9 |
| `FONDATION_BOARD_SHARING.md` (ce fichier) | Créé | Rapport |

## Edge case considéré

**Un membre tente une action owner-only** (rename, delete, gestion des membres) : `requireOwnerOnly()` est appelée, le membre n'est ni owner ni admin, un `ForbiddenException` est levé → `403`. Le message est explicite : *"Only the owner of board X may do that"*. Cela couvre R8 sans fuite d'information (pas de `404` qui révélerait l'existence du board).
