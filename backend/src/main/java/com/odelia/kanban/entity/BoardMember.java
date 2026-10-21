package com.odelia.kanban.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * A user who has been granted {@code MEMBER} access to a board by its owner.
 *
 * <p>The board's owner is <em>not</em> stored as a row here — {@code Board.owner}
 * already answers that question. This table only records the extra collaborators
 * the owner has invited.</p>
 *
 * <p>Like {@link BoardList} and {@link Card}, the parent board is referenced by
 * its identifier rather than by a JPA association: the Jakarta Data repositories
 * stay simple and the JSON stays flat.</p>
 */
@Entity
@Table(name = "BOARD_MEMBER", uniqueConstraints = {
    @UniqueConstraint(columnNames = { "BOARD_ID", "USERNAME" })
})
public class BoardMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "BOARD_ID", nullable = false)
    private long boardId;

    @NotBlank
    @Size(max = 120)
    @Column(name = "USERNAME", nullable = false, length = 120)
    private String username;

    public BoardMember() {
    }

    public BoardMember(long boardId, String username) {
        this.boardId = boardId;
        this.username = username;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public long getBoardId() {
        return boardId;
    }

    public void setBoardId(long boardId) {
        this.boardId = boardId;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }
}
