package com.odelia.kanban.repository;

import com.odelia.kanban.entity.BoardMember;
import jakarta.data.repository.CrudRepository;
import jakarta.data.repository.Repository;

import java.util.List;

/**
 * Jakarta Data repository for {@link BoardMember}.
 *
 * <p>Every method here is "query by method name": Jakarta Data derives the query
 * from the name, so no implementation and no JPQL is needed. {@code CrudRepository}
 * already provides {@code save}, {@code insert}, {@code findById}, {@code delete}
 * and {@code deleteById}.</p>
 */
@Repository(dataStore = "jdbc/kanban")
public interface BoardMemberRepository extends CrudRepository<BoardMember, Long> {

    /** The members of one board, for {@code GET /api/boards/{id}/members} (R3). */
    List<BoardMember> findByBoardIdOrderByUsernameAsc(long boardId);

    /** The memberships of one user, for {@code GET /api/boards} (R6). */
    List<BoardMember> findByUsernameOrderByBoardIdAsc(String username);

    /** True when {@code username} is already a member of {@code boardId} (R5). */
    boolean existsByBoardIdAndUsername(long boardId, String username);

    /** Removes one member; used by {@code DELETE /api/boards/{id}/members/{username}} (R4). */
    void deleteByBoardIdAndUsername(long boardId, String username);

    /** Removes every member of a board; used when the board itself is deleted. */
    void deleteByBoardId(long boardId);
}
