package com.odelia.kanban.repository;

import com.odelia.kanban.entity.Board;
import jakarta.data.repository.CrudRepository;
import jakarta.data.repository.Find;
import jakarta.data.repository.OrderBy;
import jakarta.data.repository.Query;
import jakarta.data.repository.Repository;

import java.util.List;

/**
 * Jakarta Data repository for {@link Board}.
 *
 * <p>{@code CrudRepository} already provides {@code save}, {@code insert},
 * {@code update}, {@code findById}, {@code findAll}, {@code delete} and
 * {@code deleteById}; only the extra queries are declared here.</p>
 *
 * <p>{@code dataStore} is the JNDI name of the {@code <dataSource>} declared in
 * {@code server.xml}. Liberty derives the persistence unit - and the database
 * schema - from the entity types used by the repository.</p>
 */
@Repository(dataStore = "jdbc/kanban")
public interface BoardRepository extends CrudRepository<Board, Long> {

    @Find
    @OrderBy("name")
    List<Board> findAllSortedByName();

    /**
     * The boards of one user - what {@code GET /api/boards} returns, where
     * {@code owner} is the {@code preferred_username} taken from the JWT.
     */
    List<Board> findByOwnerOrderByNameAsc(String owner);

    /**
     * The boards a user can see: the ones they own <em>and</em> the ones they
     * are a member of (R6). Query-by-method-name cannot express the OR with a
     * subquery, so the JPQL is written explicitly.
     */
    @Query("SELECT b FROM Board b WHERE b.owner = ?1 OR b.id IN " +
           "(SELECT m.boardId FROM BoardMember m WHERE m.username = ?1)")
    @OrderBy("name")
    List<Board> findOwnedOrMember(String username);
}
