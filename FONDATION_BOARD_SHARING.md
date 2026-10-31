# Exercice 17 — Rapport : Board Sharing (BoardMember)

## Backend
### R1 - Entité BoardMember

Fichiers créés : entity/BoardMember.java, repository/BoardMemberRepository.java

Table BOARD_MEMBER avec trois colonnes : id (auto-généré), BOARD_ID (non null), USERNAME (non null, max 120). Contrainte d'unicité sur (BOARD_ID, USERNAME) au niveau
base de données. Le owner n'est volontairement pas stocké ici, Board.owner répond déjà à cette question, ce qui évite la redondance et garantit qu'il n'existe qu'une
seule représentation de la relation owner. L'entité suit les conventions du projet : pas de @ManyToOne, le board est référencé par boardId comme dans BoardList et Card.

Le repository expose 5 méthodes en query-by-method-name : findByBoardIdOrderByUsernameAsc (R3), findByUsernameOrderByBoardIdAsc (R6 - préparatoire, non utilisée
directement), existsByBoardIdAndUsername (R5), deleteByBoardIdAndUsername (R4), deleteByBoardId (nettoyage cascade).


### R2 - POST /api/boards/{id}/members

Fichier : BoardResource.java, méthode addMember

Body JSON { "username": "bob" } désérialisé dans un record AddMemberRequest(@NotBlank @Size(max = 120) String username). La méthode charge le board (404 s'il n'existe
pas), appelle access.requireOwnerOnly(board) (403 si l'appelant n'est ni owner ni admin). Deux validations avant insertion : si le username est celui du owner → 400
(R10), si le username est déjà membre (existsByBoardIdAndUsername) → 400 (R5). Insertion via members.insert(new BoardMember(id, username)), retour 201 Created avec l'URI
du membre.


### R3 - GET /api/boards/{id}/members

Fichier : BoardResource.java, méthode listMembers

Charge le board (404), appelle access.requireBoardAccess(board), donc owner, member ou admin peuvent lister. Retourne members.findByBoardIdOrderByUsernameAsc(id), une
liste triée par ordre alphabétique des usernames.


### R4 - DELETE /api/boards/{id}/members/{username}

Fichier : BoardResource.java, méthode removeMember

Charge le board (404), requireOwnerOnly (403 pour un membre). Validation : si le username cible est le owner → 400 (R10). Suppression via
members.deleteByBoardIdAndUsername(id, username) dans une transaction. Effet immédiat : la ligne est supprimée, le prochain appel du membre retiré passera par
requireBoardAccess et échouera avec 403. Retour 204 No Content.

Nettoyage cascade : deleteBoard() appelle members.deleteByBoardId(id) avant de supprimer le board, pour ne pas laisser de lignes orphelines.


### R5 - Doublon rejeté avec 400

Dans addMember : members.existsByBoardIdAndUsername(id, username) → si vrai, throw badRequest("User '...' is already a member of this board"). badRequest est un helper
privé qui crée un WebApplicationException avec Response.Status.BAD_REQUEST. La contrainte d'unicité en base (@UniqueConstraint) est une seconde ligne de défense.


### R6 - GET /api/boards retourne owned + membre

Fichiers : BoardRepository.java (modifié), BoardResource.java (modifié)

Nouvelle méthode dans BoardRepository :

@Query("SELECT b FROM Board b WHERE b.owner = ?1 OR b.id IN " +
       "(SELECT m.boardId FROM BoardMember m WHERE m.username = ?1)")
@OrderBy("name")
List<Board> findOwnedOrMember(String username);

Le query-by-method-name ne peut pas exprimer un OR avec sous-requête, d'où le JPQL explicite avec @Query (pas @Find, qui est réservé aux requêtes dérivées). listBoards()
appelle findOwnedOrMember(currentUser.name()) pour un non-admin, findAllSortedByName() pour un admin (inchangé).


### R7 - Un membre peut lire/écrire colonnes et cartes

Fichier : BoardAccess.java (modifié)

requireBoardAccess(Board) a été modifiée pour accepter trois cas : admin (retour immédiat), owner (currentUser.name().equals(board.getOwner())), member
(members.existsByBoardIdAndUsername(board.getId(), currentUser.name())). Si aucun ne correspond → ForbiddenException (403).

requireColumnAccess et requireCardAccess délèguent à requireBoardAccess, donc BoardListResource et CardResource fonctionnent pour un membre sans aucune modification. Les
endpoints concernés : GET/PUT/DELETE /lists/{id}, GET/POST /lists/{id}/cards, GET/PUT/DELETE /cards/{id}, PATCH /cards/{id}/move, GET/POST /boards/{id}/lists, GET
/boards/{id}.


### R8 - Un membre ne peut pas renommer/supprimer/gérer les membres

Fichiers : BoardResource.java (modifié), BoardAccess.java (modifié)

Deux mécanismes :

 1. requireOwnerOnly(Board) dans BoardAccess, même structure que requireBoardAccess mais sans le check membre. Owner ou admin passent, un membre reçoit
    ForbiddenException("Only the owner of board X may do that") → 403.
 2. ownedBoard(id) dans BoardResource, méthode privée qui charge le board puis appelle requireOwnerOnly. Utilisée par :
    ▪ updateBoard() (PUT rename), avant, passait par accessibleBoard (qui acceptait les membres depuis la fondation)
    ▪ deleteBoard() (DELETE)
    ▪ addMember() et removeMember() (R2, R4)

accessibleBoard() (avec requireBoardAccess) reste pour getBoard, listColumns, addColumn, actions ouvertes aux membres.

Résultat : un membre qui tente PUT /api/boards/{id} ou DELETE /api/boards/{id} ou POST /api/boards/{id}/members reçoit un 403, pas un 404 ni un 500.


### R9 - Étranger toujours refusé

Comportement hérité de requireBoardAccess : si l'appelant n'est ni admin, ni owner, ni membre (existsByBoardIdAndUsername retourne false), un ForbiddenException est levé
→ 403. Aucun changement nécessaire, la fondation le couvre.


### R10 - Owner ne peut pas être membre

Deux validations dans BoardResource :

• addMember : if (username.equals(board.getOwner())) throw badRequest("The owner is already part of the board")
• removeMember : if (username.equals(board.getOwner())) throw badRequest("The owner cannot be removed from the board")

Conception sous-jacente : le owner n'est jamais stocké dans BOARD_MEMBER (R1), donc ces checks empêchent de créer une row owner dans la table des membres, que ce soit
par ajout ou par suppression détournée.

## Frontend
Les exigences F1 à F5 ont été traitées côté Angular.

F1 - Boards partagés dans la liste : vérifié que la liste affiche tous les boards renvoyés par GET /api/boards, y compris ceux dont l’utilisateur connecté n’est pas propriétaire. Ajout d’un test avec un board personnel et un board partagé.
F2 - Liste des membres dans le détail : ajout du modèle BoardMember, de l’appel GET /api/boards/{id}/members et d’un panneau affichant les noms des membres dans le détail du board. Si aucun membre n’est présent, un message l’indique.
F3 - Gestion des membres par le propriétaire : ajout des appels API pour inviter un utilisateur par username et retirer un membre. Ces contrôles sont affichés uniquement au propriétaire, déterminé en comparant le propriétaire du board au username Keycloak.
F4 - Erreurs lisibles : les échecs d’ajout et de retrait s’affichent dans le signal d’erreur existant. Les réponses 403 ont un message clair ; pour les 400, le détail fourni par l’API est affiché lorsqu’il est disponible.
F5 - Suppression réservée au propriétaire et à l’admin : le bouton Delete n’est pas affiché pour les membres des boards partagés. Il reste visible pour le propriétaire et les admins.

Fichiers concernés
board.ts
board.service.ts
board-detail.component.ts
board-detail.component.html
board-detail.component.css
board-detail.component.spec.ts
board-list.component.ts
board-list.component.html
board-list.component.spec.ts

Vérifications effectuées
Les tests ciblés du détail ont réussi (9 tests) et ceux de la liste aussi (2 tests). Le build Angular a réussi après les changements F4 et F5. Pour F1, le test dédié avait réussi, mais il n’a pas été relancé après les changements suivants.
